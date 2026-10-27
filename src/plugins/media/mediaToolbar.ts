import type { Editor } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { type BlockToolbarAction, type BlockToolbarDefinition, type BlockToolbarGroup } from '../../editor/core'
import { MEDIA_NODE, MEDIA_TOOLBAR_SLOT, type MediaAlign } from './extensions'
import { deleteMedia, setMediaDetails, setMediaLayout } from './operations'
import { openPanel } from './panelStore'
import { asKind, embedOriginal, isHttpUrl, isSafeMediaSrc, type MediaKind } from './sources'

interface Found {
  readonly pos: number
  readonly src: string
  readonly kind: MediaKind
  readonly name: string
}

const describe = (node: { attrs: Record<string, unknown> }, pos: number): Found => ({
  pos,
  src: String(node.attrs.src ?? ''),
  kind: asKind(node.attrs.kind),
  name: String(node.attrs.name ?? ''),
})

/** The media block holding the selection (selected as a block, or the caret in its caption). */
export function findSelectedMedia(editor: Editor): Found | null {
  const { selection } = editor.state
  if (selection instanceof NodeSelection && selection.node.type.name === MEDIA_NODE) {
    return describe(selection.node, selection.from)
  }
  const { $head } = selection
  for (let depth = $head.depth; depth > 0; depth -= 1) {
    if ($head.node(depth).type.name === MEDIA_NODE) return describe($head.node(depth), $head.before(depth))
  }
  return null
}

/** Opens the original in a new tab. Only http(s) sources; the new tab gets no opener. */
export const openOriginal = (src: string) => {
  const target = isHttpUrl(src) ? src : embedOriginal(src)
  if (target) window.open(target, '_blank', 'noopener,noreferrer')
}

const saveAs = (href: string, name: string) => {
  const link = document.createElement('a')
  link.href = href
  link.download = name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/**
 * Downloads the source. Data URLs download directly. A remote link is fetched first, because the browser
 * ignores `download` for cross-origin links and would navigate the editor tab away; if the fetch is
 * refused (CORS), the original opens in a new tab instead.
 */
export const downloadSource = async (src: string, kind: MediaKind = 'image', name = ''): Promise<void> => {
  if (kind === 'embed' || !isSafeMediaSrc(kind, src)) return
  if (!isHttpUrl(src)) return saveAs(src, name)
  try {
    const response = await fetch(src)
    if (!response.ok) throw new Error(String(response.status))
    const url = URL.createObjectURL(await response.blob())
    saveAs(url, name)
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } catch {
    openOriginal(src)
  }
}

const currentOf = (editor: Editor) => findSelectedMedia(editor)
const attrsAt = (editor: Editor, pos: number) => editor.state.doc.nodeAt(pos)?.attrs ?? {}
/** Editing actions need a selected block and an editable page: a locked page never changes through the bar. */
const target = (editor: Editor) => (editor.isEditable ? currentOf(editor) : null)
const editable = (editor: Editor) => editor.isEditable && currentOf(editor) !== null

const align = (value: MediaAlign, label: string): BlockToolbarAction => ({
  id: `media:align-${value}`,
  label,
  title: `Align ${label.toLowerCase()}`,
  can: editable,
  isActive: (editor) => {
    const found = currentOf(editor)
    return found !== null && (attrsAt(editor, found.pos).align ?? 'center') === value
  },
  run: (editor) => {
    const found = target(editor)
    if (found) void setMediaLayout.run(editor, found.pos, { align: value })
  },
})

const caption: BlockToolbarAction = {
  id: 'media:caption',
  label: 'Caption',
  title: 'Show or hide the caption',
  can: editable,
  isActive: (editor) => {
    const found = currentOf(editor)
    return found !== null && attrsAt(editor, found.pos).showCaption !== false
  },
  run: (editor) => {
    const found = target(editor)
    if (!found) return
    const on = attrsAt(editor, found.pos).showCaption !== false
    setMediaDetails.run(editor, found.pos, { showCaption: !on })
    if (!on) {
      // Showing the caption puts the caret in it, ready to type.
      const node = editor.state.doc.nodeAt(found.pos)
      if (node) {
        const end = found.pos + node.nodeSize - 1
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, end)))
        editor.view.focus()
      }
    }
  },
}

const download: BlockToolbarAction = {
  id: 'media:download',
  label: 'Download',
  title: 'Download',
  can: (editor) => {
    const found = currentOf(editor)
    return found !== null && found.kind !== 'embed' && isSafeMediaSrc(found.kind, found.src)
  },
  run: (editor) => {
    const found = currentOf(editor)
    if (found) void downloadSource(found.src, found.kind, found.name)
  },
}

const original: BlockToolbarAction = {
  id: 'media:open-original',
  label: 'Open original',
  title: 'Open original in a new tab',
  can: (editor) => {
    const found = currentOf(editor)
    return found !== null && (isHttpUrl(found.src) || embedOriginal(found.src) !== '')
  },
  run: (editor) => {
    const found = currentOf(editor)
    if (found) openOriginal(found.src)
  },
}

const opener =
  (id: string, label: string, title: string, open: (editor: Editor, found: Found) => void, only?: MediaKind) =>
  (): BlockToolbarAction => ({
    id,
    label,
    title,
    can: (editor) => editable(editor) && (only === undefined || currentOf(editor)?.kind === only),
    run: (editor) => {
      const found = target(editor)
      if (found) open(editor, found)
    },
  })

const replace = opener('media:replace', 'Replace', 'Replace with an upload or a link', (editor, found) =>
  openPanel(editor, { type: 'replace', pos: found.pos, kind: found.kind, tab: 'upload' }),
)()
const altText = opener('media:alt', 'Alt text', 'Describe the image for screen readers', (editor, found) =>
  openPanel(editor, { type: 'alt', pos: found.pos }),
)()
const linkAction = opener('media:link', 'Link', 'Make the image a link', (editor, found) =>
  openPanel(editor, { type: 'link', pos: found.pos }),
)()
const crop = opener('media:crop', 'Crop', 'Crop to a shape', (editor, found) =>
  openPanel(editor, { type: 'crop', pos: found.pos }),
)()
const fullscreen: BlockToolbarAction = {
  id: 'media:fullscreen',
  label: 'Full screen',
  title: 'View full screen (Space)',
  can: (editor) => currentOf(editor) !== null,
  run: (editor) => {
    const found = currentOf(editor)
    if (found) openPanel(editor, { type: 'fullscreen', pos: found.pos })
  },
}

const fullWidth: BlockToolbarAction = {
  id: 'media:full-width',
  label: 'Full width',
  title: 'Fill the available width',
  can: (editor) => editable(editor) && attrsAt(editor, currentOf(editor)?.pos ?? -1).full !== true,
  run: (editor) => {
    const found = target(editor)
    if (found) void setMediaLayout.run(editor, found.pos, { width: null, full: true })
  },
}

const resetSize: BlockToolbarAction = {
  id: 'media:toolbar-reset-size',
  label: 'Reset size',
  title: 'Reset size',
  can: (editor) => {
    const found = currentOf(editor)
    if (!editable(editor) || found === null) return false
    const attrs = attrsAt(editor, found.pos)
    return attrs.width !== null || attrs.full === true
  },
  run: (editor) => {
    const found = target(editor)
    if (found) void setMediaLayout.run(editor, found.pos, { width: null, full: false })
  },
}

const remove: BlockToolbarAction = {
  id: 'media:delete',
  label: 'Delete',
  title: 'Delete this block',
  danger: true,
  can: editable,
  run: (editor) => {
    const found = target(editor)
    if (found) void deleteMedia.run(editor, found.pos)
  },
}

const notFull = (editor: Editor) => {
  const found = currentOf(editor)
  return found !== null && attrsAt(editor, found.pos).full !== true
}

/** One bar per kind of media; the shared block-toolbar API shows the one whose kind holds the selection. */
function toolbarFor(
  id: string,
  label: string,
  kinds: readonly MediaKind[],
  extra: {
    readonly aligns: boolean
    readonly captions: boolean
    readonly openers: readonly BlockToolbarAction[]
    readonly resize: boolean
    readonly links?: boolean
  },
): BlockToolbarDefinition {
  const groups: BlockToolbarGroup[] = []
  if (extra.aligns) {
    groups.push({
      kind: 'menus',
      menus: [
        {
          id: 'align',
          label: 'Align',
          title: 'Alignment',
          visible: notFull,
          sections: [[align('left', 'Left'), align('center', 'Center'), align('right', 'Right')]],
        },
      ],
    })
  }
  if (extra.captions) groups.push({ kind: 'buttons', actions: [caption] })
  groups.push({ kind: 'buttons', actions: [download, original] })
  groups.push({
    kind: 'menus',
    menus: [
      {
        id: 'more',
        label: 'More',
        title: 'More',
        sections: [[replace, ...extra.openers], ...(extra.resize ? [[fullWidth, resetSize]] : []), [remove]],
      },
    ],
  })
  return {
    id,
    label,
    locate: (editor) => {
      const found = currentOf(editor)
      return found !== null && kinds.includes(found.kind) ? found.pos : null
    },
    slot: (blockDom) => blockDom.querySelector(`[${MEDIA_TOOLBAR_SLOT}]`),
    groups,
  }
}

export const mediaToolbars: readonly BlockToolbarDefinition[] = [
  toolbarFor('media:toolbar', 'Image', ['image'], {
    aligns: true,
    captions: true,
    openers: [linkAction, altText, crop, fullscreen],
    resize: true,
  }),
  toolbarFor('media:toolbar-video', 'Video', ['video', 'embed'], {
    aligns: true,
    captions: true,
    openers: [],
    resize: true,
  }),
  toolbarFor('media:toolbar-audio', 'Audio', ['audio'], { aligns: false, captions: true, openers: [], resize: false }),
  toolbarFor('media:toolbar-file', 'File', ['file'], { aligns: false, captions: true, openers: [], resize: false }),
]

/** The image bar (kept as the default export of this module for callers that only need one). */
export const mediaToolbar: BlockToolbarDefinition = mediaToolbars[0]
