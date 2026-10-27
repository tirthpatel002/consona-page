// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Callout } from './Callout'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mount = (onEdit?: (field: 'title' | 'body', next: string) => boolean) => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(<Callout variant="info" title="T" body="B" onEdit={onEdit} />))
  return { host, unmount: () => act(() => root.unmount()) }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Callout inline editing', () => {
  it('is plain text when not editable', () => {
    const { host, unmount } = mount()
    expect(host.querySelector('[contenteditable]')).toBeNull()
    expect(host.textContent).toContain('B')
    unmount()
  })

  it('commits a changed field once on blur and reverts when rejected', () => {
    const onEdit = vi.fn((_field: 'title' | 'body', next: string) => next !== '')
    const { host, unmount } = mount(onEdit)
    const body = host.querySelector<HTMLElement>('[aria-label="Callout text"]')
    if (!body) throw new Error('callout body field missing')
    act(() => {
      body.focus()
      body.textContent = 'new text'
      body.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(onEdit).toHaveBeenCalledWith('body', 'new text')
    expect(onEdit).toHaveBeenCalledTimes(1)
    act(() => {
      body.textContent = ''
      body.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(body.textContent).toBe('B')
    unmount()
  })
})
