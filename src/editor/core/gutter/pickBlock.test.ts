import { describe, expect, it } from 'vitest'
import { ATOM_LINE_HEIGHT, firstLineCenter, pickBlockIndex } from './pickBlock'

const boxes = [
  { top: 0, bottom: 20 },
  { top: 30, bottom: 80 },
  { top: 100, bottom: 120 },
]

describe('pickBlockIndex', () => {
  it('returns the block containing y', () => {
    expect(pickBlockIndex(boxes, 10)).toBe(0)
    expect(pickBlockIndex(boxes, 30)).toBe(1)
    expect(pickBlockIndex(boxes, 120)).toBe(2)
  })
  it('picks the nearest block in gaps and outside', () => {
    expect(pickBlockIndex(boxes, 24)).toBe(0)
    expect(pickBlockIndex(boxes, 27)).toBe(1)
    expect(pickBlockIndex(boxes, 95)).toBe(2)
    expect(pickBlockIndex(boxes, -40)).toBe(0)
    expect(pickBlockIndex(boxes, 500)).toBe(2)
  })
  it('returns -1 without blocks', () => {
    expect(pickBlockIndex([], 10)).toBe(-1)
  })
})

describe('firstLineCenter', () => {
  it('centres on the first text line when there is one', () => {
    expect(firstLineCenter({ top: 100, bottom: 400 }, { top: 104, bottom: 124 })).toBe(114)
  })
  it('centres on the top line of an atom block, or on a short block itself', () => {
    expect(firstLineCenter({ top: 100, bottom: 400 }, null)).toBe(100 + ATOM_LINE_HEIGHT / 2)
    expect(firstLineCenter({ top: 100, bottom: 102 }, null)).toBe(101)
  })
})
