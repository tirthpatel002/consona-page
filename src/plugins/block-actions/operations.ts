import { Fragment } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'
import { defineOperation } from '../../editor/core'
import { planMove, type MoveDirection } from './moveBlock'

/** Duplicates the top-level block at `pos` right below itself. */
export const duplicateBlock = defineOperation('duplicateBlock', (chain, pos: number) =>
  chain.command(({ tr, dispatch }) => {
    const node = tr.doc.nodeAt(pos)
    if (!node) return false
    if (dispatch) tr.insert(pos + node.nodeSize, node)
    return true
  }),
)

/** Moves the top-level block at `pos` one place up or down and selects it. */
export const moveBlockOp = defineOperation('moveBlock', (chain, pos: number, direction: MoveDirection) =>
  chain.command(({ tr, dispatch }) => {
    const plan = planMove(tr.doc, pos, direction)
    const node = tr.doc.nodeAt(pos)
    if (!plan || !node) return false
    if (dispatch) {
      tr.delete(plan.from, plan.to).insert(plan.insertAt, node)
      tr.setSelection(NodeSelection.create(tr.doc, plan.insertAt))
    }
    return true
  }),
)

/** Deletes the top-level block at `pos`. */
export const deleteBlock = defineOperation('deleteBlock', (chain, pos: number) =>
  chain.command(({ tr, dispatch }) => {
    const node = tr.doc.nodeAt(pos)
    if (!node) return false
    if (dispatch) {
      // Removing the last child of a parent that cannot be empty (a list's only item) removes the parent too.
      let from = pos
      let to = pos + node.nodeSize
      for (let $at = tr.doc.resolve(pos); $at.depth > 0; $at = tr.doc.resolve(from)) {
        const parent = $at.parent
        if (parent.childCount !== 1 || parent.type.validContent(Fragment.empty)) break
        from = $at.before()
        to = $at.after()
      }
      tr.delete(from, to)
    }
    return true
  }),
)
