import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { MEDIA_NODE, type MediaKind } from './extensions'
import { kindOfFile, kindOfUrl, readAsDataUrl } from './files'
import { insertMedia, setMediaLayout } from './operations'

const MIN_WIDTH = 80

/** Reads each media file and inserts it at `at` (or the caret). Failures are reported through `onProblem`. */
export async function insertFiles(
  editor: Editor,
  files: readonly File[],
  at: number | undefined,
  onProblem: (message: string) => void,
): Promise<number> {
  let inserted = 0
  let position = at
  for (const file of files) {
    const kind = kindOfFile(file)
    if (!kind) continue
    const result = await readAsDataUrl(file)
    if (!result.ok) {
      onProblem(result.reason)
      continue
    }
    if (insertMedia.run(editor, kind, result.src, position)) {
      inserted += 1
      if (position !== undefined) position = editor.state.selection.to
    }
  }
  return inserted
}

export const mediaWarning = (message: string) => {
  if (typeof window !== 'undefined') window.alert(message)
}

const filesOf = (data: DataTransfer | null): File[] =>
  data ? [...data.files].filter((file) => kindOfFile(file) !== null) : []

/** Paste and drop of image/video files, paste of a bare media URL, and drag-to-resize on the media frame. */
export const MediaBehavior = Extension.create({
  name: 'pageMediaBehavior',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('pageMediaBehavior'),
        props: {
          handlePaste: (_view, event) => {
            const files = filesOf(event.clipboardData)
            if (files.length > 0) {
              void insertFiles(editor, files, undefined, mediaWarning)
              return true
            }
            const text = event.clipboardData?.getData('text/plain') ?? ''
            const kind = kindOfUrl(text)
            if (kind && editor.state.selection.empty && !/\s/.test(text.trim())) {
              return insertMedia.run(editor, kind, text.trim())
            }
            return false
          },
          handleDrop: (view, event) => {
            const files = filesOf(event.dataTransfer)
            if (files.length === 0) return false
            event.preventDefault()
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
            const at = coords ? blockBoundaryAt(view, coords.pos) : undefined
            void insertFiles(editor, files, at, mediaWarning)
            return true
          },
        },
        view: (view) => attachResize(view, editor),
      }),
    ]
  },
})

/** Position just after the top-level block containing `pos` (drops land between blocks). */
function blockBoundaryAt(view: EditorView, pos: number): number {
  const $pos = view.state.doc.resolve(pos)
  return $pos.depth === 0 ? pos : $pos.after(1)
}

function attachResize(view: EditorView, editor: Editor) {
  interface Drag {
    readonly pos: number
    readonly box: DOMRect
    readonly startX: number
    readonly align: string
    readonly max: number
    readonly ghost: HTMLElement
    width: number
  }
  let drag: Drag | null = null
  const widthFor = (current: Drag, clientX: number): number => {
    const delta = (clientX - current.startX) * (current.align === 'center' ? 2 : 1)
    return Math.max(MIN_WIDTH, Math.min(current.max, current.box.width + delta))
  }
  // The preview is a ghost frame: changing the figure's own style would make ProseMirror redraw it mid-drag.
  const place = (current: Drag) => {
    const { box, align, width, ghost } = current
    const left =
      align === 'left' ? box.left : align === 'right' ? box.right - width : box.left + (box.width - width) / 2
    ghost.style.left = `${left}px`
    ghost.style.width = `${width}px`
  }
  const onDown = (event: MouseEvent) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return
    const handle = event.target.closest('.page-media__resize')
    const figure = handle?.closest<HTMLElement>('figure.page-media')
    const caption = figure?.querySelector('figcaption')
    if (!handle || !figure || !caption) return
    event.preventDefault()
    event.stopPropagation()
    const box = figure.getBoundingClientRect()
    const frame = figure.querySelector('.page-media__frame')?.getBoundingClientRect() ?? box
    const ghost = document.createElement('div')
    ghost.className = 'page-media-ghost'
    ghost.style.top = `${frame.top}px`
    ghost.style.height = `${frame.height}px`
    document.body.appendChild(ghost)
    drag = {
      pos: view.posAtDOM(caption, 0) - 1,
      box,
      startX: event.clientX,
      align: figure.getAttribute('data-align') ?? 'center',
      max: view.dom.getBoundingClientRect().width,
      ghost,
      width: box.width,
    }
    place(drag)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  const onMove = (event: MouseEvent) => {
    if (!drag) return
    drag.width = widthFor(drag, event.clientX)
    place(drag)
  }
  const finish = (commit: boolean, clientX: number) => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    const current = drag
    drag = null
    if (!current) return
    current.ghost.remove()
    if (!commit) return
    const width = widthFor(current, clientX)
    if (view.state.doc.nodeAt(current.pos)?.type.name === MEDIA_NODE) setMediaLayout.run(editor, current.pos, { width })
  }
  const onUp = (event: MouseEvent) => finish(true, event.clientX)
  view.dom.addEventListener('mousedown', onDown, true)
  return {
    destroy() {
      view.dom.removeEventListener('mousedown', onDown, true)
      finish(false, 0)
    },
  }
}

export const kindLabel = (kind: MediaKind) => (kind === 'image' ? 'Image' : 'Video')
