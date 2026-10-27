import { describe, expect, it, vi } from 'vitest'
import { SlashStore } from './slashStore'
import type { SlashItem } from './types'

const items: SlashItem[] = ['a', 'b', 'c'].map((id) => ({ id, title: id, group: 'G', run: () => undefined }))

describe('SlashStore', () => {
  it('navigates with wrap-around and selects the active item', () => {
    const store = new SlashStore()
    const choose = vi.fn()
    store.show(items, null, choose)
    expect(store.handleKey({ key: 'ArrowUp' })).toBe(true)
    expect(store.getState().activeIndex).toBe(2)
    store.handleKey({ key: 'ArrowDown' })
    expect(store.getState().activeIndex).toBe(0)
    store.handleKey({ key: 'Enter' })
    expect(choose).toHaveBeenCalledWith(items[0])
  })

  it('closes on Escape and ignores keys while closed', () => {
    const store = new SlashStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.show(items, null, vi.fn())
    expect(store.handleKey({ key: 'Escape' })).toBe(true)
    expect(store.getState().open).toBe(false)
    expect(store.handleKey({ key: 'ArrowDown' })).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('clamps the active index when results shrink', () => {
    const store = new SlashStore()
    store.show(items, null, vi.fn())
    store.setActive(2)
    store.show(items.slice(0, 1), null, vi.fn())
    expect(store.getState().activeIndex).toBe(0)
  })
})
