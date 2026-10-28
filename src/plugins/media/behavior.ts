import { Extension, type Editor } from '@tiptap/core'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { createBlobAdopter } from './adopt'
import { MEDIA_NODE } from './extensions'
import { mediaHost } from './host'
import { kindOfAny, kindOfFile, kindOfUrl, importFile } from './files'
import { insertMedia, setMediaLayout } from './operations'
import { openPanel } from './panelStore'
import { clamp, type MediaKind } from './sources'

const MIN_WIDTH = 80
const KEY_STEP = 16
const KEY_STEP_BIG = 64

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
    const kind = kindOfAny(file)
    if (!kind) continue
    const result = await importFile(file)
    if (!result.ok) {
      onProblem(result.reason)
      continue
    }
    const extras = {
      showCaption: false,
      ...(kind === 'file' ? { name: file.name, size: file.size } : {}),
      ...(result.blob ? { blob: result.blob } : {}),
    }
    if (insertMedia.run(editor, kind, result.src, position, extras)) {
      inserted += 1
      if (position !== undefined) position = editor.state.selection.to
    }
  }
  return inserted
}

export const mediaWarning = (message: string) => {
  if (typeof window !== 'undefined') window.alert(message)
}

const filesOf = (data: DataTransfer | null, documents: boolean): File[] =>
  data ? [...data.files].filter((file) => (documents ? kindOfAny(file) : kindOfFile(file)) !== null) : []

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
            const files = filesOf(event.clipboardData, false)
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
          // A press on the picture, player area or file card selects the block; handles, links and players keep their own presses.
          handleClickOn: (view, _pos, node, nodePos, event) => {
            if (node.type.name !== MEDIA_NODE || !(event.target instanceof Element)) return false
            if (!event.target.closest('.page-media__frame')) return false
            if (event.target.closest('.page-media__resize, a, audio, button, .page-media__video-ui, .page-media__audio'))
              return false
            // The custom video control bar keeps its presses; the picture above it selects the block.
            const player = event.target.closest('video')
            if (player) {
              const box = player.getBoundingClientRect()
              if (event.clientY > box.bottom - 52) return false
            }
            if (view.state.selection instanceof NodeSelection && view.state.selection.from === nodePos) {
              view.focus()
              return true
            }
            view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)))
            view.focus()
            return true
          },
          handleKeyDown: (_view, event) => {
            // Space on a selected image opens it full screen.
            if (event.key !== ' ' || event.metaKey || event.ctrlKey || event.altKey) return false
            const { selection } = editor.state
            if (!(selection instanceof NodeSelection) || selection.node.type.name !== MEDIA_NODE) return false
            if (selection.node.attrs.kind !== 'image') return false
            event.preventDefault()
            openPanel(editor, { type: 'fullscreen', pos: selection.from })
            return true
          },
          handleDrop: (view, event) => {
            const files = filesOf(event.dataTransfer, true)
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
      new Plugin({
        key: new PluginKey('pageMediaAdopt'),
        view: () => {
          const { blobs, pageId } = mediaHost()
          if (!blobs || !pageId) return {}
          const adopter = createBlobAdopter(editor, blobs, pageId, mediaWarning)
          adopter.scan()
          let editable = editor.isEditable
          const onFocus = () => adopter.retry()
          editor.on('focus', onFocus)
          return {
            update: (_view, prev) => {
              // An unlock re-checks everything the locked page skipped.
              if (editor.isEditable !== editable) {
                editable = editor.isEditable
                adopter.retry()
              } else if (prev.doc !== editor.state.doc) adopter.scan()
            },
            destroy: () => {
              editor.off('focus', onFocus)
              adopter.destroy()
            },
          }
        },
      }),
    ]
  },
})

/** Position just after the top-level block containing `pos` (drops land between blocks). */
function blockBoundaryAt(view: EditorView, pos: number): number {
  const $pos = view.state.doc.resolve(pos)
  return $pos.depth === 0 ? pos : $pos.after(1)
}

/** Width a drag or key press leads to, snapping to the full available width near its edge. */
export function nextWidth(current: number, delta: number, max: number): { width: number; full: boolean } {
  const width = clamp(current + delta, MIN_WIDTH, max)
  return { width, full: width >= max - SNAP_PX }
}

const SNAP_PX = 12

function attachResize(view: EditorView, editor: Editor) {
  interface Drag {
    readonly pos: number
    readonly box: DOMRect
    readonly startX: number
    readonly pointerId: number
    readonly sign: 1 | -1
    readonly align: string
    readonly max: number
    readonly ghost: HTMLElement
    width: number
  }
  let drag: Drag | null = null
  const maxOf = (figure: HTMLElement) =>
    figure.parentElement?.getBoundingClientRect().width ?? view.dom.getBoundingClientRect().width
  const widthFor = (current: Drag, clientX: number) => {
    const delta = (clientX - current.startX) * current.sign * (current.align === 'center' ? 2 : 1)
    return nextWidth(current.box.width, delta, current.max)
  }
  // The preview is a ghost frame: changing the figure's own style would make ProseMirror redraw it mid-drag.
  const place = (current: Drag) => {
    const { box, align, width, ghost } = current
    const left =
      align === 'left' ? box.left : align === 'right' ? box.right - width : box.left + (box.width - width) / 2
    ghost.style.left = `${left}px`
    ghost.style.width = `${width}px`
    ghost.dataset.snap = width >= current.max - SNAP_PX ? 'full' : ''
  }
  const mediaPosOf = (figure: HTMLElement): number | null => {
    const caption = figure.querySelector('figcaption')
    return caption ? view.posAtDOM(caption, 0) - 1 : null
  }
  const onDown = (event: PointerEvent) => {
    if (!editor.isEditable || event.button !== 0 || !(event.target instanceof Element)) return
    const handle = event.target.closest<HTMLElement>('.page-media__resize')
    const figure = handle?.closest<HTMLElement>('figure.page-media')
    const pos = figure ? mediaPosOf(figure) : null
    if (!handle || !figure || pos === null) return
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
      pos,
      box,
      startX: event.clientX,
      pointerId: event.pointerId,
      sign: handle.getAttribute('data-edge') === 'left' ? -1 : 1,
      align: figure.getAttribute('data-align') ?? 'center',
      max: maxOf(figure),
      ghost,
      width: box.width,
    }
    place(drag)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKeyDown, true)
  }
  const onMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    drag.width = widthFor(drag, event.clientX).width
    place(drag)
  }
  const finish = (commit: boolean, clientX: number) => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKeyDown, true)
    const current = drag
    drag = null
    if (!current) return
    current.ghost.remove()
    if (!commit) return
    const { width, full } = widthFor(current, clientX)
    if (view.state.doc.nodeAt(current.pos)?.type.name === MEDIA_NODE) {
      setMediaLayout.run(editor, current.pos, full ? { width: null, full: true } : { width, full: false })
    }
  }
  const onUp = (event: PointerEvent) => finish(true, event.clientX)
  const onCancel = () => finish(false, 0)
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    finish(false, 0)
  }
  /** Arrow keys on a focused handle change the width; Home resets it, End makes it full width. */
  const onHandleKey = (event: KeyboardEvent) => {
    if (!editor.isEditable || !(event.target instanceof Element)) return
    const handle = event.target.closest<HTMLElement>('.page-media__resize')
    const figure = handle?.closest<HTMLElement>('figure.page-media')
    const pos = figure ? mediaPosOf(figure) : null
    if (!handle || !figure || pos === null) return
    const step = event.shiftKey ? KEY_STEP_BIG : KEY_STEP
    const grow = handle.getAttribute('data-edge') === 'left' ? 'ArrowLeft' : 'ArrowRight'
    const delta = event.key === grow ? step : event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? -step : 0
    if (delta !== 0) {
      const next = nextWidth(figure.getBoundingClientRect().width, delta, maxOf(figure))
      setMediaLayout.run(editor, pos, next.full ? { width: null, full: true } : { width: next.width, full: false })
    } else if (event.key === 'Home') setMediaLayout.run(editor, pos, { width: null, full: false })
    else if (event.key === 'End') setMediaLayout.run(editor, pos, { width: null, full: true })
    else return
    event.preventDefault()
    event.stopPropagation()
    requestAnimationFrame(() => {
      const again = view.nodeDOM(pos)
      if (again instanceof HTMLElement)
        again
          .querySelector<HTMLElement>(`.page-media__resize[data-edge="${handle.getAttribute('data-edge')}"]`)
          ?.focus()
    })
  }
  view.dom.addEventListener('pointerdown', onDown, true)
  view.dom.addEventListener('keydown', onHandleKey, true)
  /** Keeps the contextual bar inside the editor column: shifts it left/right when the block sits near an edge. */
  const clampBar = () => {
    const slot = view.dom.querySelector<HTMLElement>('.page-media__toolbar-slot:not(:empty)')
    if (!slot) return
    slot.style.left = ''
    delete slot.dataset.placement
    const host = view.dom.getBoundingClientRect()
    slot.style.maxWidth = `${Math.max(120, Math.floor(host.width))}px`
    let rect = slot.getBoundingClientRect()
    if (rect.width === 0) return
    // Above the block unless that would slide under the sticky toolbar or off the top of the window.
    const toolbarBottom = document.querySelector('.page-toolbar')?.getBoundingClientRect().bottom ?? 0
    // A bar above a video would cover its player chrome; audio keeps the bar below its custom player.
    const kind = slot.closest<HTMLElement>('.page-media')?.dataset.kind
    if (kind === 'video' || kind === 'embed') slot.dataset.placement = 'inside'
    else if (kind === 'audio' || rect.top < Math.max(toolbarBottom, 0) + 4) slot.dataset.placement = 'below'
    rect = slot.getBoundingClientRect()
    const left = host.left
    const right = host.right
    let shift = 0
    if (rect.right > right) shift = right - rect.right
    if (rect.left + shift < left) shift = left - rect.left
    // `left`, not a transform: a transformed ancestor would break the fixed-position menus inside the bar.
    if (shift !== 0) slot.style.left = `${Math.round(shift)}px`
  }
  /** Marks pictures that failed to load so the block shows a notice rather than collapsing. */
  const markBroken = () => {
    for (const img of view.dom.querySelectorAll<HTMLImageElement>('.page-media__frame img[src]')) {
      const frame = img.closest('.page-media__frame')
      if (img.complete && img.naturalWidth === 0) frame?.setAttribute('data-broken', '')
      else if (img.complete) frame?.removeAttribute('data-broken')
    }
  }
  view.dom.addEventListener('error', () => requestAnimationFrame(markBroken), true)
  window.addEventListener('resize', clampBar)
  window.addEventListener('scroll', clampBar, true)
  // The bar content is a React portal that fills in after the selection update, so watch for it too.
  const watcher = new MutationObserver(() => requestAnimationFrame(clampBar))
  watcher.observe(view.dom, { childList: true, subtree: true })
  return {
    update() {
      requestAnimationFrame(clampBar)
      // Layout can settle a moment later (panels closing, pictures loading).
      setTimeout(clampBar, 150)
      setTimeout(markBroken, 150)
      setTimeout(markBroken, 1200)
    },
    destroy() {
      window.removeEventListener('resize', clampBar)
      window.removeEventListener('scroll', clampBar, true)
      watcher.disconnect()
      view.dom.removeEventListener('pointerdown', onDown, true)
      view.dom.removeEventListener('keydown', onHandleKey, true)
      finish(false, 0)
    },
  }
}

export const kindLabel = (kind: MediaKind) =>
  kind === 'image'
    ? 'Image'
    : kind === 'video'
      ? 'Video'
      : kind === 'audio'
        ? 'Audio'
        : kind === 'file'
          ? 'File'
          : 'Embed'
