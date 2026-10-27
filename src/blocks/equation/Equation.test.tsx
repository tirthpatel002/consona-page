// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Equation } from './Equation'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mount = (latex: string, onEdit?: (next: string) => boolean) => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(<Equation latex={latex} onEdit={onEdit} />))
  return { host, unmount: () => act(() => root.unmount()) }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Equation rendering', () => {
  it('renders valid LaTeX as KaTeX', () => {
    const { host, unmount } = mount('E = mc^2')
    expect(host.querySelector('.katex')).not.toBeNull()
    unmount()
  })

  it('shows the source and the parse error for invalid LaTeX', () => {
    const { host, unmount } = mount('\\frac{1}')
    expect(host.querySelector('.katex')).toBeNull()
    const error = host.querySelector('.page-equation--error')
    expect(error?.textContent).toContain('\\frac{1}')
    expect(error?.querySelector('small')?.textContent?.length).toBeGreaterThan(0)
    unmount()
  })

  it('shows a placeholder for an empty source and no field until clicked', () => {
    const { host, unmount } = mount('', () => true)
    expect(host.textContent).toContain('Click to add equation')
    expect(host.querySelector('[contenteditable]')).toBeNull()
    unmount()
  })

  it('commits edited source once on blur after opening the editor', () => {
    const onEdit = vi.fn(() => true)
    const { host, unmount } = mount('a', onEdit)
    act(() => host.querySelector<HTMLButtonElement>('.page-equation--interactive')?.click())
    const field = host.querySelector<HTMLElement>('[aria-label="Equation LaTeX"]')
    if (!field) throw new Error('equation field missing')
    act(() => {
      field.textContent = 'a^2 + b^2'
      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(onEdit).toHaveBeenCalledWith('a^2 + b^2')
    expect(onEdit).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('returns to preview on Enter even when LaTeX did not change', () => {
    const onEdit = vi.fn(() => true)
    const { host, unmount } = mount('a^2', onEdit)
    act(() => host.querySelector<HTMLButtonElement>('.page-equation--interactive')?.click())
    expect(host.querySelector('[contenteditable]')).not.toBeNull()
    const field = host.querySelector<HTMLElement>('[aria-label="Equation LaTeX"]')
    if (!field) throw new Error('equation field missing')
    act(() => {
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(onEdit).not.toHaveBeenCalled()
    expect(host.querySelector('[contenteditable]')).toBeNull()
    expect(host.querySelector('.page-equation--interactive')).not.toBeNull()
    unmount()
  })
})
