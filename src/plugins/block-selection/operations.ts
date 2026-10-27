import { defineOperation } from '../../editor/core'

/** Copies the top-level blocks in `[from, to)` right after themselves, as one undo step. */
export const duplicateRange = defineOperation('duplicateRange', (chain, from: number, to: number) =>
  chain.command(({ tr, dispatch }) => {
    if (to <= from) return false
    if (dispatch) tr.insert(to, tr.doc.slice(from, to).content)
    return true
  }),
)
