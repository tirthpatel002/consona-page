// Pure geometry for the block gutter (hover target + first-line anchor).

export interface VerticalBox {
  readonly top: number
  readonly bottom: number
}

/**
 * Index of the block whose box contains `y`; between blocks (margins) or outside, the nearest one.
 * -1 when there are no blocks.
 */
export function pickBlockIndex(boxes: readonly VerticalBox[], y: number): number {
  let best = -1
  let bestDistance = Infinity
  boxes.forEach((box, index) => {
    const distance = y < box.top ? box.top - y : y > box.bottom ? y - box.bottom : 0
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

/** Default first-line height for blocks without text (embeds, rules): the gutter centres on it. */
export const ATOM_LINE_HEIGHT = 24

/** Vertical centre of a block's first line: a text line if it has one, else its top `ATOM_LINE_HEIGHT` px. */
export function firstLineCenter(block: VerticalBox, textLine: VerticalBox | null): number {
  if (textLine) return (textLine.top + textLine.bottom) / 2
  return block.top + Math.min(block.bottom - block.top, ATOM_LINE_HEIGHT) / 2
}

export interface EntryBox extends VerticalBox {
  readonly left: number
  readonly right: number
  readonly depth: number
}

/**
 * Index of the block nearest to the pointer in both axes (0 distance = inside); ties go to the deeper block so
 * a block inside a column wins over the column list that contains it. -1 when there are no blocks.
 */
export function pickEntryIndex(boxes: readonly EntryBox[], x: number, y: number): number {
  let best = -1
  let bestDistance = Infinity
  let bestDepth = -1
  boxes.forEach((box, index) => {
    const dy = y < box.top ? box.top - y : y > box.bottom ? y - box.bottom : 0
    const dx = x < box.left ? box.left - x : x > box.right ? x - box.right : 0
    const distance = dy * 4 + dx
    if (distance < bestDistance || (distance === bestDistance && box.depth > bestDepth)) {
      best = index
      bestDistance = distance
      bestDepth = box.depth
    }
  })
  return best
}
