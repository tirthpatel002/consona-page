import { describe, expect, it } from 'vitest'
import { moveBlockSelection, selectedRange, spanIndexAt, spansInRect, type BlockSpan } from './blockRange'

const spans: BlockSpan[] = [
  { pos: 0, end: 5 },
  { pos: 5, end: 12 },
  { pos: 12, end: 20 },
]

describe('block selection helpers', () => {
  it('finds the block containing a position', () => {
    expect(spanIndexAt(spans, 3)).toBe(0)
    expect(spanIndexAt(spans, 13)).toBe(2)
    expect(spanIndexAt(spans, 99)).toBe(-1)
  })
  it('moves a single selection and clamps at the ends', () => {
    expect(moveBlockSelection({ anchor: 1, head: 1 }, 'ArrowDown', false, 3)).toEqual({ anchor: 2, head: 2 })
    expect(moveBlockSelection({ anchor: 2, head: 2 }, 'ArrowDown', false, 3)).toEqual({ anchor: 2, head: 2 })
    expect(moveBlockSelection({ anchor: 0, head: 0 }, 'ArrowUp', false, 3)).toEqual({ anchor: 0, head: 0 })
  })
  it('extends from the anchor with Shift and collapses to the edge without it', () => {
    const extended = moveBlockSelection({ anchor: 0, head: 0 }, 'ArrowDown', true, 3)
    expect(extended).toEqual({ anchor: 0, head: 1 })
    expect(moveBlockSelection(extended, 'ArrowDown', true, 3)).toEqual({ anchor: 0, head: 2 })
    expect(moveBlockSelection(extended, 'ArrowDown', false, 3)).toEqual({ anchor: 2, head: 2 })
    expect(moveBlockSelection({ anchor: 1, head: 2 }, 'ArrowUp', false, 3)).toEqual({ anchor: 0, head: 0 })
  })
  it('gives the document range of the selected blocks', () => {
    expect(selectedRange(spans, { anchor: 2, head: 1 })).toEqual({ from: 5, to: 20 })
    expect(selectedRange(spans, { anchor: 9, head: 9 })).toBeNull()
  })
})

describe('spansInRect', () => {
  const rects = [
    { top: 0, bottom: 20, left: 0, right: 200 },
    { top: 30, bottom: 50, left: 0, right: 200 },
    { top: 60, bottom: 80, left: 0, right: 200 },
  ]
  it('returns the first and last overlapped block', () => {
    expect(spansInRect(rects, { top: 35, bottom: 65, left: 0, right: 200 })).toEqual({ first: 1, last: 2 })
    expect(spansInRect(rects, { top: 22, bottom: 28, left: 0, right: 200 })).toBeNull()
  })
  it('requires horizontal overlap with each block, not just vertical band', () => {
    expect(spansInRect(rects, { top: 0, bottom: 80, left: 0, right: 20 })).toEqual({ first: 0, last: 2 })
    expect(spansInRect(rects, { top: 35, bottom: 65, left: 300, right: 320 })).toBeNull()
  })
})
