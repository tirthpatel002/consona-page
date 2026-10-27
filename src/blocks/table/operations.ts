import { defineOperation } from '../../editor/core'

/** Inserts a 3x3 table with a header row at the selection. */
export const insertTable = defineOperation('insertTable', (chain) =>
  chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
)
