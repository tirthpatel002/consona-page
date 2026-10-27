import type { Node as PMNode } from '@tiptap/pm/model'

export type MoveDirection = 'up' | 'down'

export interface MovePlan {
  /** Range of the node to remove. */
  readonly from: number
  readonly to: number
  /** Insert position *after* the removal has been applied. */
  readonly insertAt: number
}

/** Computes how to move the top-level-or-nested child at `pos` one sibling up/down. Pure. */
export function planMove(doc: PMNode, pos: number, direction: MoveDirection): MovePlan | null {
  if (!Number.isInteger(pos) || pos < 0 || pos >= doc.content.size) return null
  const node = doc.nodeAt(pos)
  if (!node) return null
  const $pos = doc.resolve(pos)
  const parent = $pos.parent
  const index = $pos.index()
  const from = pos
  const to = pos + node.nodeSize

  if (direction === 'up') {
    const previous = index > 0 ? parent.child(index - 1) : null
    return previous ? { from, to, insertAt: pos - previous.nodeSize } : null
  }
  const next = index < parent.childCount - 1 ? parent.child(index + 1) : null
  return next ? { from, to, insertAt: pos + next.nodeSize } : null
}
