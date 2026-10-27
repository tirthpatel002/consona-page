import type { JSONContent } from '@tiptap/core'
import { Fragment, type Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { BLOCK_REMOVAL_META, defineOperation } from '../../editor/core'
import { MAX_COLUMNS, MAX_GRID_TRACKS, MIN_COLUMNS, MIN_GRID_TRACKS, maxCells } from './extensions'

/** Weights: ratio only; 1 each means equal widths. */
const emptyColumn = (): JSONContent => ({ type: 'column', attrs: { width: 1 }, content: [{ type: 'paragraph' }] })

/** Builds a column list with `count` empty columns (clamped to the allowed range). */
export function columnListContent(count: number, layout: 'columns' | 'grid' = 'columns'): JSONContent {
  const n = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, Math.round(count)))
  return { type: 'columnList', attrs: { layout }, content: Array.from({ length: n }, emptyColumn) }
}

/** Replaces the current empty block with (or inserts after the current block) a column list, caret in the first column. */
export const insertColumns = defineOperation('insertColumns', (chain, count: number, layout: 'columns' | 'grid') =>
  chain.command(({ state, tr, dispatch }) => {
    const { $from } = state.selection
    for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'column') return false
    const block = $from.node(1)
    const start = $from.before(1)
    const replace = block.type.name === 'paragraph' && block.content.size === 0
    const at = replace ? start : start + block.nodeSize
    if (dispatch) {
      const node = state.schema.nodeFromJSON(columnListContent(count, layout))
      if (replace) tr.replaceWith(start, start + block.nodeSize, node)
      else tr.insert(at, node)
      tr.setSelection(TextSelection.near(tr.doc.resolve(at + 3)))
    }
    return true
  }),
)

/** Appends an empty column to the list at `pos` (up to the maximum). */
export const addColumn = defineOperation('addColumn', (chain, pos: number) =>
  chain.command(({ state, tr, dispatch }) => {
    const list = state.doc.nodeAt(pos)
    if (list?.type.name !== 'columnList' || list.childCount >= maxCells(list.attrs.layout)) return false
    if (dispatch) tr.insert(pos + list.nodeSize - 1, state.schema.nodeFromJSON(emptyColumn()))
    return true
  }),
)

/** Removes the last column of the list at `pos`; its blocks move to the end of the previous column. */
export const removeLastColumn = defineOperation('removeLastColumn', (chain, pos: number) =>
  chain.command(({ state, tr, dispatch }) => {
    const list = state.doc.nodeAt(pos)
    if (list?.type.name !== 'columnList' || list.childCount <= MIN_COLUMNS) return false
    if (dispatch) {
      const last = list.lastChild
      if (!last) return false
      const lastStart = pos + list.nodeSize - 1 - last.nodeSize
      const previousEnd = lastStart - 1
      tr.delete(lastStart, lastStart + last.nodeSize)
      tr.insert(previousEnd, last.content)
    }
    return true
  }),
)

/** Switches the list at `pos` between side-by-side columns and a wrapping grid. */
export const setColumnsLayout = defineOperation('setColumnsLayout', (chain, pos: number, layout: 'columns' | 'grid') =>
  chain.command(({ state, tr, dispatch }) => {
    const list = state.doc.nodeAt(pos)
    if (list?.type.name !== 'columnList' || list.attrs.layout === layout) return false
    if (layout === 'columns' && list.childCount > MAX_COLUMNS) return false // too many cells for one row
    if (dispatch)
      tr.setNodeMarkup(pos, undefined, { ...list.attrs, layout, tracks: layout === 'grid' ? list.attrs.tracks : null })
    return true
  }),
)

/** Replaces the list at `pos` with its blocks one after another (column order). */
export const ungroupColumns = defineOperation('ungroupColumns', (chain, pos: number) =>
  chain.command(({ state, tr, dispatch }) => {
    const list = state.doc.nodeAt(pos)
    if (list?.type.name !== 'columnList') return false
    if (dispatch) {
      const blocks: ReturnType<typeof state.schema.nodeFromJSON>[] = []
      list.forEach((column) => column.forEach((child) => blocks.push(child)))
      tr.replaceWith(pos, pos + list.nodeSize, blocks)
    }
    return true
  }),
)

export type DropSide = 'left' | 'right'

type DropPlan =
  | { kind: 'wrap'; at: number; end: number; target: PMNode; moved: Fragment }
  | { kind: 'add'; at: number; moved: Fragment }

/**
 * Where a side drop of `[from, to)` beside the block at `targetPos` would go, or null when it is not allowed:
 * the range must be plain blocks (no column list: columns do not nest), must not contain the target, and a
 * list can hold at most MAX_COLUMNS columns.
 */
export function planDropBeside(
  doc: PMNode,
  from: number,
  to: number,
  targetPos: number,
  side: DropSide,
): DropPlan | null {
  const target = doc.nodeAt(targetPos)
  if (!target || to <= from || (targetPos >= from && targetPos < to)) return null
  const moved = doc.slice(from, to).content
  let hasList = false
  moved.descendants((node) => {
    if (node.type.name === 'columnList') hasList = true
    return !hasList
  })
  if (hasList || moved.childCount === 0) return null
  const $target = doc.resolve(targetPos)
  if ($target.parent.type.name === 'column') {
    const list = $target.node($target.depth - 1)
    if (list.type.name !== 'columnList' || list.childCount >= maxCells(list.attrs.layout)) return null
    const columnStart = $target.before($target.depth)
    return { kind: 'add', at: side === 'left' ? columnStart : columnStart + $target.parent.nodeSize, moved }
  }
  if ($target.depth !== 0) return null
  if (target.type.name === 'columnList') {
    if (target.childCount >= maxCells(target.attrs.layout)) return null
    return { kind: 'add', at: side === 'left' ? targetPos + 1 : targetPos + target.nodeSize - 1, moved }
  }
  return { kind: 'wrap', at: targetPos, end: targetPos + target.nodeSize, target, moved }
}

/**
 * Drops `[from, to)` beside the block at `targetPos`: next to a plain block it creates a column list; next to a
 * block in a column list (or at the edge of one) it adds a column. Emptied source columns are removed afterwards.
 */
export const dropBeside = defineOperation(
  'dropBeside',
  (chain, from: number, to: number, targetPos: number, side: DropSide) =>
    chain.command(({ state, tr, dispatch }) => {
      const plan = planDropBeside(state.doc, from, to, targetPos, side)
      if (!plan) return false
      if (dispatch) {
        const { column, columnList } = state.schema.nodes
        if (!column || !columnList) return false
        const fresh = column.create({ width: 1 }, plan.moved)
        if (plan.kind === 'wrap') {
          const existing = column.create({ width: 1 }, Fragment.from(plan.target))
          const pair = side === 'left' ? [fresh, existing] : [existing, fresh]
          tr.replaceWith(plan.at, plan.end, columnList.create({ layout: 'columns' }, pair))
        } else {
          tr.insert(plan.at, fresh)
        }
        tr.setMeta(BLOCK_REMOVAL_META, { from, to })
        tr.delete(tr.mapping.map(from), tr.mapping.map(to))
      }
      return true
    }),
)

/** Sets the relative width of every column of the list at `pos` (one weight per column). */
export const setColumnWidths = defineOperation('setColumnWidths', (chain, pos: number, widths: readonly number[]) =>
  chain.command(({ state, tr, dispatch }) => {
    const list = state.doc.nodeAt(pos)
    if (list?.type.name !== 'columnList' || widths.length !== list.childCount) return false
    if (widths.some((w) => !Number.isFinite(w) || w <= 0)) return false
    const unchanged = widths.every((w, i) => list.child(i).attrs.width === w)
    if (unchanged) return false
    if (dispatch) {
      let offset = pos + 1
      list.forEach((column, _o, index) => {
        tr.setNodeMarkup(offset, undefined, { ...column.attrs, width: widths[index] })
        offset += column.nodeSize
      })
    }
    return true
  }),
)

/** Sets how many cells a grid shows per row (null = as many as fit). One undo step. */
export const setGridTracks = defineOperation('setGridTracks', (chain, pos: number, tracks: number | null) =>
  chain.command(({ state, tr, dispatch }) => {
    const list = state.doc.nodeAt(pos)
    if (list?.type.name !== 'columnList' || list.attrs.layout !== 'grid') return false
    const next = tracks === null ? null : Math.max(MIN_GRID_TRACKS, Math.min(MAX_GRID_TRACKS, Math.round(tracks)))
    if (next === (list.attrs.tracks ?? null)) return false
    if (dispatch) tr.setNodeMarkup(pos, undefined, { ...list.attrs, tracks: next })
    return true
  }),
)
