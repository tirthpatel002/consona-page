import type { Command } from '@tiptap/pm/state'
import { isInTable, selectedRect } from '@tiptap/pm/tables'
import { reorderTransaction } from './reorder'
import { leadingHeaderRows } from './tableQueries'

/** Moves the selection's (left-most) column one step; the caret stays in the same cell. */
export const moveColumnBy =
  (delta: -1 | 1): Command =>
  (state, dispatch) => {
    if (!isInTable(state)) return false
    const rect = selectedRect(state)
    const from = rect.left
    const tr = reorderTransaction(state, rect.tableStart - 1, 'column', from, from + delta, {
      kind: 'caret',
      row: rect.top,
      column: from + delta,
    })
    if (!tr) return false
    dispatch?.(tr)
    return true
  }

/** Moves the selection's (top-most) body row one step; header rows never move and are never passed. */
export const moveRowBy =
  (delta: -1 | 1): Command =>
  (state, dispatch) => {
    if (!isInTable(state)) return false
    const rect = selectedRect(state)
    if (rect.top < leadingHeaderRows(rect.table)) return false
    const tr = reorderTransaction(state, rect.tableStart - 1, 'row', rect.top, rect.top + delta, {
      kind: 'caret',
      row: rect.top + delta,
      column: rect.left,
    })
    if (!tr) return false
    dispatch?.(tr)
    return true
  }
