// Pure geometry for pointer dragging of top-level blocks.

import type { VerticalBox } from './pickBlock'

/** Insertion slot (0..boxes.length) for a pointer at `y`: before the first block whose midpoint is below it. */
export function dropSlot(boxes: readonly VerticalBox[], y: number): number {
  const index = boxes.findIndex((box) => y < (box.top + box.bottom) / 2)
  return index === -1 ? boxes.length : index
}

/** Y of the drop indicator for `slot`: the gap between the neighbouring blocks (or the outer edge). */
export function slotY(boxes: readonly VerticalBox[], slot: number): number | null {
  const before = boxes[slot - 1]
  const after = boxes[slot]
  if (before && after) return (before.bottom + after.top) / 2
  if (after) return after.top
  if (before) return before.bottom
  return null
}

/** True when dropping block `from` into `slot` would not change the order. */
export const isNoopMove = (from: number, slot: number): boolean => slot === from || slot === from + 1

/** Pixels to scroll per frame: negative near the top edge, positive near the bottom, 0 elsewhere; grows with proximity. */
export function autoScrollDelta(y: number, viewportHeight: number, edge = 64, maxStep = 20): number {
  if (y < edge) return -Math.ceil((maxStep * Math.min(edge, edge - y)) / edge)
  if (y > viewportHeight - edge) return Math.ceil((maxStep * Math.min(edge, y - (viewportHeight - edge))) / edge)
  return 0
}
