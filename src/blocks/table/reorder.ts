import { Fragment, type Node as PMNode } from '@tiptap/pm/model'
import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { CellSelection, TableMap } from '@tiptap/pm/tables'
import { leadingHeaderRows } from './tableQueries'

export type ReorderAxis = 'row' | 'column'

const spanOf = (cell: PMNode, attr: 'colspan' | 'rowspan'): number => {
  const value: unknown = cell.attrs[attr]
  return typeof value === 'number' ? value : 1
}

const anyCell = (table: PMNode, test: (cell: PMNode) => boolean): boolean => {
  let found = false
  table.forEach((row) => {
    row.forEach((cell) => {
      if (test(cell)) found = true
    })
  })
  return found
}

/** A grid every row of which has the same number of cells and no merged cell can be reordered by plain cell moves. */
const isPlainGrid = (table: PMNode, attr: 'colspan' | 'rowspan'): boolean => {
  if (anyCell(table, (cell) => spanOf(cell, attr) > 1)) return false
  const width = table.firstChild?.childCount ?? 0
  let uniform = true
  table.forEach((row) => {
    if (row.childCount !== width) uniform = false
  })
  return uniform
}

/** Why columns cannot be reordered in this table (merged cells would be torn apart), or null. */
export function columnReorderBlocker(table: PMNode): string | null {
  if (!isPlainGrid(table, 'colspan') || anyCell(table, (cell) => spanOf(cell, 'rowspan') > 1)) {
    return 'Columns can’t be reordered while cells are merged. Split the merged cells first.'
  }
  return (table.firstChild?.childCount ?? 0) < 2 ? 'A table needs at least two columns to reorder them.' : null
}

/** Why body rows cannot be reordered in this table, or null. Header rows stay on top and never move. */
export function rowReorderBlocker(table: PMNode): string | null {
  if (!isPlainGrid(table, 'rowspan') || anyCell(table, (cell) => spanOf(cell, 'colspan') > 1)) {
    return 'Rows can’t be reordered while cells are merged. Split the merged cells first.'
  }
  return table.childCount - leadingHeaderRows(table) < 2
    ? 'A table needs at least two body rows to reorder them.'
    : null
}

/** Final index of an item picked up from `from` and dropped into insertion slot `slot` (0..count). */
export function targetIndexForSlot(from: number, slot: number): number {
  return slot > from ? slot - 1 : slot
}

/** Insertion slot (0..centers.length) for a pointer coordinate, from the centres of the items. */
export function slotForPointer(centers: readonly number[], pointer: number, minSlot = 0): number {
  let slot = 0
  for (const center of centers) {
    if (center < pointer) slot += 1
  }
  return Math.max(minSlot, slot)
}

const array = <T>(count: number, at: (index: number) => T): T[] => Array.from({ length: count }, (_, i) => at(i))

const moveItem = <T>(items: readonly T[], from: number, to: number): T[] => {
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item === undefined) return next
  next.splice(to, 0, item)
  return next
}

/**
 * The table with column `from` moved to index `to`. Existing cell nodes are reused (content, attrs, column
 * widths, block ids stay), so nothing is rewritten. Null when not applicable.
 */
export function movedColumnTable(table: PMNode, from: number, to: number): PMNode | null {
  const width = table.firstChild?.childCount ?? 0
  if (columnReorderBlocker(table) !== null) return null
  if (from === to || from < 0 || to < 0 || from >= width || to >= width) return null
  const rows = array(table.childCount, (r) => {
    const row = table.child(r)
    return row.copy(
      Fragment.from(
        moveItem(
          array(row.childCount, (c) => row.child(c)),
          from,
          to,
        ),
      ),
    )
  })
  return table.copy(Fragment.from(rows))
}

/** The table with body row `from` moved to row index `to` (both at or below the header rows). */
export function movedRowTable(table: PMNode, from: number, to: number): PMNode | null {
  const headerCount = leadingHeaderRows(table)
  if (rowReorderBlocker(table) !== null) return null
  if (from === to || from < headerCount || to < headerCount || from >= table.childCount || to >= table.childCount) {
    return null
  }
  const rows = moveItem(
    array(table.childCount, (r) => table.child(r)),
    from,
    to,
  )
  return table.copy(Fragment.from(rows))
}

export type AfterMove =
  /** Select the moved column / row as cells (drag and handle click). */
  | { readonly kind: 'cells' }
  /** Put the caret back in the cell at this row and column (toolbar actions). */
  | { readonly kind: 'caret'; readonly row: number; readonly column: number }

function selectAfter(tr: Transaction, tablePos: number, axis: ReorderAxis, index: number, after: AfterMove) {
  const table = tr.doc.nodeAt(tablePos)
  if (!table) return
  const map = TableMap.get(table)
  const start = tablePos + 1
  if (after.kind === 'caret') {
    const offset = map.map[after.row * map.width + after.column]
    if (offset !== undefined) tr.setSelection(TextSelection.near(tr.doc.resolve(start + offset + 1)))
    return
  }
  const cellAt = (row: number, column: number) => tr.doc.resolve(start + map.positionAt(row, column, table))
  tr.setSelection(
    axis === 'column'
      ? CellSelection.colSelection(cellAt(map.height - 1, index), cellAt(0, index))
      : CellSelection.rowSelection(cellAt(index, map.width - 1), cellAt(index, 0)),
  )
}

/**
 * Moves a column or body row of the table at `tablePos`: one replace step, so one undo step. Returns the
 * transaction (not dispatched) or null when the move is not allowed or changes nothing.
 */
export function reorderTransaction(
  state: EditorState,
  tablePos: number,
  axis: ReorderAxis,
  from: number,
  to: number,
  after: AfterMove,
): Transaction | null {
  const table = state.doc.nodeAt(tablePos)
  if (!table || table.type.spec.tableRole !== 'table') return null
  const moved = axis === 'column' ? movedColumnTable(table, from, to) : movedRowTable(table, from, to)
  if (!moved) return null
  const tr = state.tr.replaceWith(tablePos, tablePos + table.nodeSize, moved)
  selectAfter(tr, tablePos, axis, to, after)
  return tr.scrollIntoView()
}
