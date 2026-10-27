// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Tabs } from './Tabs'
import type { TabItem } from './model'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const TABS: readonly TabItem[] = [
  { id: 'a', title: 'One', body: 'First body' },
  { id: 'b', title: 'Two', body: 'Second body' },
]

const mount = (onEdit?: (next: readonly TabItem[]) => boolean) => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(<Tabs tabs={TABS} onEdit={onEdit} />))
  return { host, unmount: () => act(() => root.unmount()) }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Tabs block', () => {
  it('shows the first tab and switches on click', () => {
    const { host, unmount } = mount()
    expect(host.querySelector('[role="tabpanel"]')?.textContent).toBe('First body')
    const second = host.querySelectorAll<HTMLElement>('[role="tab"]')[1]
    act(() => second.click())
    expect(host.querySelector('[role="tabpanel"]')?.textContent).toBe('Second body')
    unmount()
  })

  it('has no editing affordances when not editable', () => {
    const { host, unmount } = mount()
    expect(host.querySelector('[contenteditable]')).toBeNull()
    expect(host.querySelector('.page-tabs__add')).toBeNull()
    unmount()
  })

  it('commits a body edit for the active tab only', () => {
    const onEdit = vi.fn((_next: readonly TabItem[]) => true)
    const { host, unmount } = mount(onEdit)
    const body = host.querySelector<HTMLElement>('[aria-label="Content of tab One"]')
    if (!body) throw new Error('body field missing')
    act(() => {
      body.focus()
      body.textContent = 'Rewritten'
      body.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(onEdit).toHaveBeenCalledWith([
      { id: 'a', title: 'One', body: 'Rewritten' },
      { id: 'b', title: 'Two', body: 'Second body' },
    ])
    unmount()
  })

  it('adds and removes tabs through the whole-list update', () => {
    const onEdit = vi.fn((_next: readonly TabItem[]) => true)
    const { host, unmount } = mount(onEdit)
    act(() => host.querySelector<HTMLButtonElement>('.page-tabs__add')?.click())
    expect(onEdit.mock.calls[0]?.[0]).toHaveLength(3)
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Remove tab One"]')?.click())
    expect(onEdit.mock.calls[1]?.[0]).toEqual([{ id: 'b', title: 'Two', body: 'Second body' }])
    unmount()
  })
})
