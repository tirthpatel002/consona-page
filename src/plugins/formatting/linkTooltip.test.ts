// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { textPlugin } from '../text'
import { formattingPlugin } from '.'

const make = (titleAttr = '') =>
  createTestEditor({
    plugins: [textPlugin(), formattingPlugin],
    content: `<p><a href="https://example.com/docs"${titleAttr}>label</a></p>`,
  })

const hover = (el: Element) => el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))

const must = <T>(value: T | null): T => {
  if (value === null) throw new Error('expected element to exist')
  return value
}

describe('linkTooltip (D3)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows the full URL after the hover delay and hides on mouseaway', () => {
    const { editor, destroy } = make()
    const anchor = must(editor.view.dom.querySelector('a[href]'))
    hover(anchor)
    expect(must(document.querySelector<HTMLElement>('.page-link-tooltip')).style.display).toBe('none')
    vi.advanceTimersByTime(400)
    const tooltip = must(document.querySelector<HTMLElement>('.page-link-tooltip'))
    expect(tooltip.style.display).toBe('block')
    expect(tooltip.textContent).toBe('https://example.com/docs')
    hover(must(editor.view.dom.querySelector('p')))
    expect(tooltip.style.display).toBe('none')
    destroy()
  })

  it('carries the full URL as the link title while hovered and removes it after', () => {
    const { editor, destroy } = make()
    const anchor = must(editor.view.dom.querySelector('a[href]'))
    hover(anchor)
    vi.advanceTimersByTime(400)
    expect(anchor.getAttribute('title')).toBe('https://example.com/docs')
    hover(must(editor.view.dom.querySelector('p')))
    expect(anchor.getAttribute('title')).toBeNull()
    destroy()
  })

  it('restores a pre-existing title instead of clobbering it', () => {
    const { editor, destroy } = make(' title="keep me"')
    const anchor = must(editor.view.dom.querySelector('a[href]'))
    hover(anchor)
    vi.advanceTimersByTime(400)
    expect(anchor.getAttribute('title')).toBe('https://example.com/docs')
    hover(must(editor.view.dom.querySelector('p')))
    expect(anchor.getAttribute('title')).toBe('keep me')
    destroy()
  })
})
