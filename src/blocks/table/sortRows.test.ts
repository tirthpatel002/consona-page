import { describe, expect, it } from 'vitest'
import { compareCellText, isIdentityOrder, parseNumeric, sortedRowOrder } from './sortRows'

describe('parseNumeric', () => {
  it.each([
    ['420', 420],
    ['-3.5', -3.5],
    ['$1,250', 1250],
    ['12%', 12],
    ['€ 9', 9],
    ['.5', 0.5],
    ['  7 ', 7],
  ])('%s → %s', (text, value) => expect(parseNumeric(text)).toBe(value))

  it.each(['', 'abc', '12 apples', '1.2.3', 'NA', '--4'])('%s → null', (text) => expect(parseNumeric(text)).toBeNull())
})

describe('compareCellText', () => {
  it('compares numbers numerically, not lexically', () => {
    expect(compareCellText('64', '420')).toBeLessThan(0)
    expect(compareCellText('1,020', '850')).toBeGreaterThan(0)
  })
  it('puts numbers before text and compares text naturally and case-insensitively', () => {
    expect(compareCellText('10', 'apple')).toBeLessThan(0)
    expect(compareCellText('item 2', 'item 10')).toBeLessThan(0)
    expect(compareCellText('apple', 'Apple')).toBe(0)
  })
})

describe('sortedRowOrder', () => {
  const arr = ['420', '210', '380', '64', '156', '512', '48']

  it('sorts ascending and descending', () => {
    expect(sortedRowOrder(arr, 'asc').map((i) => arr[i])).toEqual(['48', '64', '156', '210', '380', '420', '512'])
    expect(sortedRowOrder(arr, 'desc').map((i) => arr[i])).toEqual(['512', '420', '380', '210', '156', '64', '48'])
  })

  it('is stable for equal keys in both directions', () => {
    const keys = ['NA', 'EU', 'NA', 'APAC', 'EU']
    expect(sortedRowOrder(keys, 'asc')).toEqual([3, 1, 4, 0, 2])
    expect(sortedRowOrder(keys, 'desc')).toEqual([0, 2, 1, 4, 3])
  })

  it('keeps empty cells at the bottom in both directions', () => {
    const keys = ['b', '', 'a', '  ']
    expect(sortedRowOrder(keys, 'asc')).toEqual([2, 0, 1, 3])
    expect(sortedRowOrder(keys, 'desc')).toEqual([0, 2, 1, 3])
  })

  it('handles empty input and reports identity orders', () => {
    expect(sortedRowOrder([], 'asc')).toEqual([])
    expect(isIdentityOrder([0, 1, 2])).toBe(true)
    expect(isIdentityOrder([1, 0])).toBe(false)
  })
})
