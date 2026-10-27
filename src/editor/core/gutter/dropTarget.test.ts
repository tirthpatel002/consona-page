import { describe, expect, it } from 'vitest'
import { autoScrollDelta, dropSlot, isNoopMove, slotY } from './dropTarget'

const boxes = [
  { top: 0, bottom: 20 },
  { top: 30, bottom: 70 },
  { top: 80, bottom: 100 },
]

describe('dropSlot', () => {
  it('picks the slot by block midpoints', () => {
    expect(dropSlot(boxes, -5)).toBe(0)
    expect(dropSlot(boxes, 9)).toBe(0)
    expect(dropSlot(boxes, 11)).toBe(1)
    expect(dropSlot(boxes, 55)).toBe(2)
    expect(dropSlot(boxes, 95)).toBe(3)
  })
  it('places the indicator in the gap or at the outer edges', () => {
    expect(slotY(boxes, 0)).toBe(0)
    expect(slotY(boxes, 1)).toBe(25)
    expect(slotY(boxes, 3)).toBe(100)
    expect(slotY([], 0)).toBeNull()
  })
  it('knows which slots do not move the block', () => {
    expect(isNoopMove(1, 1)).toBe(true)
    expect(isNoopMove(1, 2)).toBe(true)
    expect(isNoopMove(1, 0)).toBe(false)
    expect(isNoopMove(1, 3)).toBe(false)
  })
})

describe('autoScrollDelta', () => {
  it('scrolls only near the viewport edges and faster closer to them', () => {
    expect(autoScrollDelta(300, 600)).toBe(0)
    expect(autoScrollDelta(60, 600)).toBeLessThan(0)
    expect(autoScrollDelta(0, 600)).toBe(-20)
    expect(autoScrollDelta(10, 600)).toBeLessThan(autoScrollDelta(50, 600) * 1)
    expect(autoScrollDelta(530, 600)).toBe(0)
    expect(autoScrollDelta(600, 600)).toBe(20)
  })
})
