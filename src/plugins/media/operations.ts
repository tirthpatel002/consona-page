import { NodeSelection } from '@tiptap/pm/state'
import { defineOperation } from '../../editor/core'
import { MEDIA_NODE, type MediaAlign, type MediaKind } from './extensions'

/** Inserts a media block at `at` (default: replaces an empty paragraph at the caret, else goes after the current block). */
export const insertMedia = defineOperation('insertMedia', (chain, kind: MediaKind, src: string, at?: number) =>
  chain.command(({ state, tr, dispatch }) => {
    const type = state.schema.nodes[MEDIA_NODE]
    if (!type || !src) return false
    if (dispatch) {
      const node = type.create({ kind, src })
      let pos = at
      if (pos === undefined && state.selection instanceof NodeSelection && state.selection.$from.depth === 0) {
        // A selected top-level block (e.g. the media just inserted): the new block goes right after it.
        pos = state.selection.to
        tr.insert(pos, node)
      } else if (pos === undefined) {
        const { $from } = state.selection
        const block = $from.node(1)
        const start = $from.before(1)
        const replace = $from.depth === 1 && block.type.name === 'paragraph' && block.content.size === 0
        if (replace) tr.replaceWith(start, start + block.nodeSize, node)
        else tr.insert(start + block.nodeSize, node)
        pos = start + (replace ? 0 : block.nodeSize)
      } else {
        tr.insert(pos, node)
      }
      tr.setSelection(NodeSelection.create(tr.doc, pos))
    }
    return true
  }),
)

export interface MediaChange {
  readonly width?: number | null
  readonly align?: MediaAlign
}

/** Changes the width and/or alignment of the media block at `pos`. */
export const setMediaLayout = defineOperation('setMediaLayout', (chain, pos: number, change: MediaChange) =>
  chain.command(({ state, tr, dispatch }) => {
    const node = state.doc.nodeAt(pos)
    if (node?.type.name !== MEDIA_NODE) return false
    const attrs = {
      ...node.attrs,
      ...(change.width !== undefined ? { width: change.width === null ? null : Math.round(change.width) } : {}),
      ...(change.align ? { align: change.align } : {}),
    }
    if (attrs.width === node.attrs.width && attrs.align === node.attrs.align) return false
    if (dispatch) tr.setNodeMarkup(pos, undefined, attrs)
    return true
  }),
)

/** Replaces the source of the media block at `pos`. */
export const setMediaSource = defineOperation('setMediaSource', (chain, pos: number, src: string) =>
  chain.command(({ state, tr, dispatch }) => {
    const node = state.doc.nodeAt(pos)
    if (node?.type.name !== MEDIA_NODE || !src || src === node.attrs.src) return false
    if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, src })
    return true
  }),
)

/** Removes the media block at `pos`. */
export const deleteMedia = defineOperation('deleteMedia', (chain, pos: number) =>
  chain.command(({ state, tr, dispatch }) => {
    const node = state.doc.nodeAt(pos)
    if (node?.type.name !== MEDIA_NODE) return false
    if (dispatch) tr.delete(pos, pos + node.nodeSize)
    return true
  }),
)
