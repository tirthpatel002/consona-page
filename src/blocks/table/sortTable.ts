import { Fragment, type Node as PMNode } from '@tiptap/pm/model'
import { TextSelection, type Command } from '@tiptap/pm/state'
import { isInTable, selectedRect } from '@tiptap/pm/tables'
import { isIdentityOrder, sortedRowOrder, type SortDirection } from './sortRows'
import { hasRowSpans, leadingHeaderRows } from './tableQueries'

/**
 * ProseMirror command: reorders the body rows of the table around the selection by the text of the
 * selection's (left-most) column. Leading header rows stay on top. One replace step → one undo.
 * Not applicable (returns false) outside a table, with < 2 body rows, or when cells span rows.
 */
export function sortTableByColumn(direction: SortDirection): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false
    const { table, map, tableStart, left } = selectedRect(state)
    if (hasRowSpans(table)) return false

    const headerCount = leadingHeaderRows(table)
    const rows: PMNode[] = []
    table.forEach((row) => rows.push(row))
    const body = rows.slice(headerCount)
    if (body.length < 2) return false

    const keys = body.map((_, i) => {
      const offset = map.map[(i + headerCount) * map.width + left]
      return offset === undefined ? '' : (table.nodeAt(offset)?.textContent ?? '')
    })
    const order = sortedRowOrder(keys, direction)
    if (!dispatch || isIdentityOrder(order)) return true

    const sorted = order.map((index) => body[index]).filter((row): row is PMNode => row !== undefined)
    const tablePos = tableStart - 1
    const tr = state.tr.replaceWith(
      tablePos,
      tablePos + table.nodeSize,
      table.copy(Fragment.from([...rows.slice(0, headerCount), ...sorted])),
    )
    // Keep the cursor in the sorted column, in the first row.
    const firstCell = tableStart + (map.map[left] ?? 0)
    tr.setSelection(TextSelection.near(tr.doc.resolve(firstCell + 1)))
    dispatch(tr.scrollIntoView())
    return true
  }
}
