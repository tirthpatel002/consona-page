import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { isSafeUrl, type BlockToolbarAction, type BlockToolbarDefinition } from '../../editor/core'
import { MEDIA_NODE, MEDIA_TOOLBAR_SLOT, type MediaAlign } from './extensions'
import { deleteMedia, setMediaLayout, setMediaSource } from './operations'

/** Position of the media block holding the selection (selected as a block, or the caret in its caption). */
export function findSelectedMedia(editor: Editor): { pos: number; src: string } | null {
  const { selection } = editor.state
  if (selection instanceof NodeSelection && selection.node.type.name === MEDIA_NODE) {
    return { pos: selection.from, src: String(selection.node.attrs.src) }
  }
  const { $head } = selection
  for (let depth = $head.depth; depth > 0; depth -= 1) {
    if ($head.node(depth).type.name === MEDIA_NODE) {
      return { pos: $head.before(depth), src: String($head.node(depth).attrs.src) }
    }
  }
  return null
}

const isHttp = (src: string) => /^https?:\/\//i.test(src) && isSafeUrl(src)

/** Opens the source in a new tab. Only http(s) sources; the new tab gets no opener. */
export const openOriginal = (src: string) => {
  if (isHttp(src)) window.open(src, '_blank', 'noopener,noreferrer')
}

/** Downloads the source (a data URL or a same-origin or CORS-allowed link). */
export const downloadSource = (src: string) => {
  if (!isSafeUrl(src)) return
  const link = document.createElement('a')
  link.href = src
  link.download = ''
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

const currentOf = (editor: Editor) => findSelectedMedia(editor)

const align = (value: MediaAlign, label: string): BlockToolbarAction => ({
  id: `media:align-${value}`,
  label,
  title: label,
  can: (editor) => currentOf(editor) !== null,
  isActive: (editor) => {
    const found = currentOf(editor)
    return found !== null && (editor.state.doc.nodeAt(found.pos)?.attrs.align ?? 'center') === value
  },
  run: (editor) => {
    const found = currentOf(editor)
    if (found) void setMediaLayout.run(editor, found.pos, { align: value })
  },
})

const download: BlockToolbarAction = {
  id: 'media:download',
  label: 'Download',
  title: 'Download',
  can: (editor) => {
    const found = currentOf(editor)
    return found !== null && isSafeUrl(found.src)
  },
  run: (editor) => {
    const found = currentOf(editor)
    if (found) downloadSource(found.src)
  },
}

const original: BlockToolbarAction = {
  id: 'media:open-original',
  label: 'Open original',
  title: 'Open original in a new tab',
  can: (editor) => {
    const found = currentOf(editor)
    return found !== null && isHttp(found.src)
  },
  run: (editor) => {
    const found = currentOf(editor)
    if (found) openOriginal(found.src)
  },
}

const replace: BlockToolbarAction = {
  id: 'media:replace',
  label: 'Replace with link',
  title: 'Replace with a typed link',
  can: (editor) => currentOf(editor) !== null,
  run: (editor) => {
    const found = currentOf(editor)
    const url = found ? window.prompt('New link (https://...)')?.trim() : undefined
    if (found && url && isHttp(url)) setMediaSource.run(editor, found.pos, url)
  },
}

const resetSize: BlockToolbarAction = {
  id: 'media:toolbar-reset-size',
  label: 'Reset size',
  title: 'Reset size',
  can: (editor) => {
    const found = currentOf(editor)
    return found !== null && editor.state.doc.nodeAt(found.pos)?.attrs.width !== null
  },
  run: (editor) => {
    const found = currentOf(editor)
    if (found) void setMediaLayout.run(editor, found.pos, { width: null })
  },
}

const remove: BlockToolbarAction = {
  id: 'media:delete',
  label: 'Delete',
  title: 'Delete this block',
  danger: true,
  can: (editor) => currentOf(editor) !== null,
  run: (editor) => {
    const found = currentOf(editor)
    if (found) void deleteMedia.run(editor, found.pos)
  },
}

/** The media block's bar, declared through the shared block-toolbar API. */
export const mediaToolbar: BlockToolbarDefinition = {
  id: 'media:toolbar',
  label: 'Media',
  locate: (editor) => currentOf(editor)?.pos ?? null,
  slot: (blockDom) => blockDom.querySelector(`[${MEDIA_TOOLBAR_SLOT}]`),
  groups: [
    { kind: 'buttons', actions: [align('left', 'Left'), align('center', 'Center'), align('right', 'Right')] },
    { kind: 'buttons', actions: [download, original] },
    {
      kind: 'menus',
      menus: [{ id: 'more', label: 'More', title: 'More', sections: [[replace, resetSize], [remove]] }],
    },
  ],
}
