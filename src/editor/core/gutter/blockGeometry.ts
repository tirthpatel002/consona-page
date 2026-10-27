import { Selection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { blockEntries, type NestedConfig } from './blockEntries'
import { firstLineCenter, pickEntryIndex } from './pickBlock'

export interface GutterAnchor {
  /** Block position (top-level or nested). */
  readonly pos: number
  /** Vertical position of the gutter and the block's left edge, relative to `container`. */
  readonly y: number
  readonly x: number
}

/** Half the gutter's height: the follow clamp keeps the whole gutter inside the block's vertical span. */
export const GUTTER_HALF_HEIGHT = 12

/**
 * How far left of a block's edge the pointer can be while still "aiming at the gutter": inside this lane the
 * anchor freezes so the controls stay put under the pointer instead of racing it.
 */
export const GUTTER_LANE_WIDTH = 96

/** How far right of a block's edge the pointer can be before the gutter stops following the cursor's height. */
export const FOLLOW_OVERSHOOT = 48

/**
 * Vertical slack while travelling the left lane: a pointer heading for the controls can clip a few pixels
 * past the anchored block's top or bottom edge (a diagonal path from a short block) without the anchor
 * jumping to the neighbouring block (A2).
 */
export const LANE_HYSTERESIS_PX = 16

/**
 * True while the pointer travels the left lane near the anchored block's row: the gutter stays put so the
 * "+" and grip remain reachable, even when the path briefly clips the neighbouring block's edge.
 */
export const keepsAnchorInLane = (
  previousRect: { readonly left: number; readonly top: number; readonly bottom: number },
  clientX: number,
  clientY: number,
): boolean =>
  clientX >= previousRect.left - GUTTER_LANE_WIDTH &&
  clientX < previousRect.left - 2 &&
  clientY >= previousRect.top - LANE_HYSTERESIS_PX &&
  clientY <= previousRect.bottom + LANE_HYSTERESIS_PX

/** Client rect of the first text line inside the block at `pos`, or null if it has no text position. */
function firstTextLine(view: EditorView, pos: number): { top: number; bottom: number } | null {
  const node = view.state.doc.nodeAt(pos)
  if (!node || node.isAtom) return null
  const inner = Selection.findFrom(view.state.doc.resolve(pos + 1), 1, true)
  if (!inner || inner.from >= pos + node.nodeSize) return null
  const { top, bottom } = view.coordsAtPos(inner.from)
  return { top, bottom }
}

/**
 * The gutter's vertical centre while the pointer hovers a block: it follows the cursor's height, clamped so
 * the whole gutter stays inside the block's vertical span.
 */
export function followAnchorY(
  block: { readonly top: number; readonly bottom: number },
  pointerY: number,
  containerTop: number,
): number {
  const min = block.top - containerTop + GUTTER_HALF_HEIGHT
  const max = Math.max(min, block.bottom - containerTop - GUTTER_HALF_HEIGHT)
  return Math.max(min, Math.min(pointerY - containerTop, max))
}

/**
 * Where the gutter goes for the block (top-level or inside a declared container) nearest to the pointer.
 * While the pointer is over a block's row, the anchor follows the cursor's height (A2); in the left gutter
 * lane the previous anchor is kept so the "+" and grip stay stable to move onto; anywhere else the anchor
 * rests on the block's first line.
 */
export function gutterAnchorAt(
  view: EditorView,
  container: HTMLElement,
  clientX: number,
  clientY: number,
  config: NestedConfig,
  previous: GutterAnchor | null = null,
): GutterAnchor | null {
  const blocks = blockEntries(view, config.containers, config)
  const rects = blocks.map((block) => block.dom.getBoundingClientRect())
  const index = pickEntryIndex(
    rects.map((rect, i) => ({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      depth: blocks[i]?.depth ?? 0,
    })),
    clientX,
    clientY,
  )
  let hit = blocks[index]
  let rect = rects[index]
  if (!hit || !rect) return null
  // The gap and padding of a column layout belong to the column list, which would yank the gutter to the
  // layout's left edge. Keep it on the nearest block inside the layout unless the pointer is in the
  // outer left margin, where the layout's own handle lives.
  if (hit.dom.classList.contains('page-columns')) {
    let nearest = -1
    let nearestDistance = Infinity
    let leftmost = Infinity
    blocks.forEach((block, i) => {
      const child = rects[i]
      if (!child || block.dom === hit?.dom || !hit?.dom.contains(block.dom)) return
      leftmost = Math.min(leftmost, child.left)
      const dy = clientY < child.top ? child.top - clientY : clientY > child.bottom ? clientY - child.bottom : 0
      const dx = clientX < child.left ? child.left - clientX : clientX > child.right ? clientX - child.right : 0
      const distance = dy * 4 + dx
      if (distance < nearestDistance) {
        nearest = i
        nearestDistance = distance
      }
    })
    const child = blocks[nearest]
    const childRect = rects[nearest]
    if (child && childRect && clientX >= leftmost - 8) {
      hit = child
      rect = childRect
    }
  }
  const box = container.getBoundingClientRect()
  const x = rect.left - box.left

  // Gutter lane: the pointer left the block heading for the controls — keep them exactly where they are,
  // even when a diagonal path briefly clips the neighbouring block's edge (LANE_HYSTERESIS_PX).
  // Inside a column layout the lane is as tall as the layout, so the controls don't vanish while the
  // pointer crosses the gap beside a short block.
  if (previous) {
    const previousBlock = blocks.find((block) => block.pos === previous.pos)
    const previousRect = previousBlock?.dom.getBoundingClientRect()
    const layout = previousBlock?.dom.closest('.page-columns')?.getBoundingClientRect()
    const laneRect = previousRect
      ? {
          left: previousRect.left,
          top: layout ? Math.min(layout.top, previousRect.top) : previousRect.top,
          bottom: layout ? Math.max(layout.bottom, previousRect.bottom) : previousRect.bottom,
        }
      : null
    if (laneRect && keepsAnchorInLane(laneRect, clientX, clientY)) return previous
  }
  // Over the block's row (with a small overshoot either side): follow the cursor's height.
  if (clientX >= rect.left - 2 && clientX <= rect.right + FOLLOW_OVERSHOOT) {
    return { pos: hit.pos, y: followAnchorY(rect, clientY, box.top), x }
  }
  // Far outside horizontally: rest on the first line, as before.
  return { pos: hit.pos, y: firstLineCenter(rect, firstTextLine(view, hit.pos)) - box.top, x }
}
