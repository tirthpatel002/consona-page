import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model'
import { NodeSelection, type EditorState } from '@tiptap/pm/state'
import { CellSelection, findTable } from '@tiptap/pm/tables'

export interface FoundTable {
  /** Position directly before the table node. */
  readonly pos: number
  readonly node: PMNode
}

const isTableNode = (node: PMNode) => node.type.spec.tableRole === 'table'

/** The table the selection is in (cursor, text range or CellSelection), or that is node-selected. */
export function findSelectedTable(state: EditorState): FoundTable | null {
  const { selection } = state
  if (selection instanceof NodeSelection && isTableNode(selection.node)) {
    return { pos: selection.from, node: selection.node }
  }
  const found = findTable(selection.$head)
  return found ? { pos: found.pos, node: found.node } : null
}

/** Number of leading rows made only of header cells (they stay on top when sorting). */
export function leadingHeaderRows(table: PMNode): number {
  let count = 0
  for (let i = 0; i < table.childCount; i += 1) {
    const row = table.child(i)
    let allHeaders = row.childCount > 0
    row.forEach((cell) => {
      if (cell.type.spec.tableRole !== 'header_cell') allHeaders = false
    })
    if (!allHeaders) break
    count += 1
  }
  return count
}

/** True if any cell spans several rows (rows can then not be reordered independently). */
export function hasRowSpans(table: PMNode): boolean {
  let found = false
  table.descendants((node) => {
    if (found) return false
    if (typeof node.attrs.rowspan === 'number' && node.attrs.rowspan > 1) found = true
    return node.type.spec.tableRole === 'table' || node.type.spec.tableRole === 'row'
  })
  return found
}

/**
 * True when `$pos` is inside (or directly in) a row that is one of its table's leading header rows —
 * where sorting is offered and columns can be resized. Header-column cells in body rows don't count.
 */
export function isHeaderRowPos($pos: ResolvedPos): boolean {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.spec.tableRole !== 'row') continue
    const table = $pos.node(depth - 1)
    return table.type.spec.tableRole === 'table' && $pos.index(depth - 1) < leadingHeaderRows(table)
  }
  return false
}

/** True when the selection head (or a CellSelection's head cell) is in a leading header row. */
export function isInHeaderRow(state: EditorState): boolean {
  const { selection } = state
  const $head = selection instanceof CellSelection ? state.doc.resolve(selection.$headCell.pos + 1) : selection.$head
  return isHeaderRowPos($head)
}
