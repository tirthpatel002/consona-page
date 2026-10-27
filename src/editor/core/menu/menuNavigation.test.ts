import { describe, expect, it } from 'vitest'
import { isMenuNavKey, moveActiveIndex } from './menuNavigation'

describe('moveActiveIndex', () => {
  const all = [true, true, true, true]

  it('starts at the first / last item when nothing is active', () => {
    expect(moveActiveIndex(all, -1, 'ArrowDown')).toBe(0)
    expect(moveActiveIndex(all, -1, 'ArrowUp')).toBe(3)
  })

  it('moves and wraps', () => {
    expect(moveActiveIndex(all, 1, 'ArrowDown')).toBe(2)
    expect(moveActiveIndex(all, 3, 'ArrowDown')).toBe(0)
    expect(moveActiveIndex(all, 0, 'ArrowUp')).toBe(3)
  })

  it('skips disabled items', () => {
    const some = [false, true, false, true]
    expect(moveActiveIndex(some, -1, 'ArrowDown')).toBe(1)
    expect(moveActiveIndex(some, 1, 'ArrowDown')).toBe(3)
    expect(moveActiveIndex(some, 3, 'ArrowDown')).toBe(1)
    expect(moveActiveIndex(some, 1, 'ArrowUp')).toBe(3)
    expect(moveActiveIndex(some, -1, 'Home')).toBe(1)
    expect(moveActiveIndex(some, -1, 'End')).toBe(3)
  })

  it('returns -1 when nothing is enabled or the menu is empty', () => {
    expect(moveActiveIndex([false, false], -1, 'ArrowDown')).toBe(-1)
    expect(moveActiveIndex([], -1, 'Home')).toBe(-1)
  })

  it('recognises navigation keys only', () => {
    expect(['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'a'].map(isMenuNavKey)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
    ])
  })
})
