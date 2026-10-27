import { NodeSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { defineOperation } from '../../editor/core'
import { MEDIA_NODE, type MediaAlign } from './extensions'
import { isBlobRef } from './host'
import {
  asFocus,
  asKind,
  asShape,
  asZoom,
  isSafeLink,
  isSafeMediaSrc,
  type MediaKind,
  type MediaShape,
} from './sources'

/** A source is an allowlisted address, or (for stored files) an empty one beside a valid `blob:` reference. */
const hasSource = (kind: MediaKind, src: string, blob: string | undefined): boolean =>
  isSafeMediaSrc(kind, src) || (src === '' && isBlobRef(blob) && ['image', 'video', 'audio', 'file'].includes(kind))

/** Changes the attributes of the block at `pos` and keeps it selected if it was (a node change would otherwise drop the selection). */
function changeAttrs(state: EditorState, tr: Transaction, pos: number, attrs: Record<string, unknown>): void {
  const wasSelected = state.selection instanceof NodeSelection && state.selection.from === pos
  tr.setNodeMarkup(pos, undefined, attrs)
  if (wasSelected) tr.setSelection(NodeSelection.create(tr.doc, pos))
}

/** Attributes a media block can carry besides its source (all optional when inserting). */
export interface MediaExtras {
  readonly alt?: string
  readonly name?: string
  readonly size?: number | null
  readonly showCaption?: boolean
  readonly link?: string
  /** Reference to a file in the host's store (`blob:<id>`); the source is then empty. */
  readonly blob?: string
}

/** Inserts a media block at `at` (default: replaces an empty paragraph at the caret, else goes after the current block). */
export const insertMedia = defineOperation(
  'insertMedia',
  (chain, kind: MediaKind, src: string, at?: number, extras?: MediaExtras) =>
    chain.command(({ state, tr, dispatch }) => {
      const type = state.schema.nodes[MEDIA_NODE]
      if (!type || !hasSource(kind, src, extras?.blob)) return false
      if (dispatch) {
        const node = type.create({ kind, src, ...extras })
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
  readonly full?: boolean
}

/** Changes the width, full-width state and/or alignment of the media block at `pos`. */
export const setMediaLayout = defineOperation('setMediaLayout', (chain, pos: number, change: MediaChange) =>
  chain.command(({ state, tr, dispatch }) => {
    const node = state.doc.nodeAt(pos)
    if (node?.type.name !== MEDIA_NODE) return false
    const attrs = {
      ...node.attrs,
      ...(change.width !== undefined ? { width: change.width === null ? null : Math.round(change.width) } : {}),
      ...(change.align ? { align: change.align } : {}),
      ...(change.full !== undefined ? { full: change.full } : {}),
    }
    // Choosing a width leaves full width, unless the change says otherwise.
    if (change.width !== undefined && change.full === undefined && change.width !== null) attrs.full = false
    if (attrs.width === node.attrs.width && attrs.align === node.attrs.align && attrs.full === node.attrs.full) {
      return false
    }
    if (dispatch) changeAttrs(state, tr, pos, attrs)
    return true
  }),
)

/** Replaces the source of the media block at `pos` (and optionally its kind, name and size). */
export const setMediaSource = defineOperation(
  'setMediaSource',
  (chain, pos: number, src: string, kind?: MediaKind, extras?: MediaExtras) =>
    chain.command(({ state, tr, dispatch }) => {
      const node = state.doc.nodeAt(pos)
      if (node?.type.name !== MEDIA_NODE) return false
      const nextKind = kind ?? asKind(node.attrs.kind)
      if (!hasSource(nextKind, src, extras?.blob)) return false
      if (src === node.attrs.src && nextKind === node.attrs.kind && (extras?.blob ?? '') === (node.attrs.blob ?? ''))
        return false
      if (dispatch) changeAttrs(state, tr, pos, { ...node.attrs, blob: '', ...extras, src, kind: nextKind })
      return true
    }),
)

export interface MediaDetails {
  readonly alt?: string
  /** Empty string removes the link. */
  readonly link?: string
  readonly showCaption?: boolean
  readonly shape?: MediaShape
  readonly zoom?: number
  readonly focusX?: number
  readonly focusY?: number
  readonly name?: string
}

/** Changes alt text, link, caption visibility, crop or file name. Values outside the allowed set are refused. */
export const setMediaDetails = defineOperation('setMediaDetails', (chain, pos: number, change: MediaDetails) =>
  chain.command(({ state, tr, dispatch }) => {
    const node = state.doc.nodeAt(pos)
    if (node?.type.name !== MEDIA_NODE) return false
    if (change.link !== undefined && change.link !== '' && !isSafeLink(change.link)) return false
    const next: Record<string, unknown> = { ...node.attrs }
    if (change.alt !== undefined) next.alt = change.alt.slice(0, 300)
    if (change.link !== undefined) next.link = change.link.trim()
    if (change.showCaption !== undefined) next.showCaption = change.showCaption
    if (change.shape !== undefined) next.shape = asShape(change.shape)
    if (change.zoom !== undefined) next.zoom = asZoom(change.zoom)
    if (change.focusX !== undefined) next.focusX = asFocus(change.focusX)
    if (change.focusY !== undefined) next.focusY = asFocus(change.focusY)
    if (change.name !== undefined) next.name = change.name.slice(0, 200)
    if (Object.keys(next).every((key) => next[key] === node.attrs[key])) return false
    if (dispatch) changeAttrs(state, tr, pos, next)
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
