// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Mermaid } from './Mermaid'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mount = (source: string, onEdit?: (next: string) => boolean) => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(<Mermaid source={source} onEdit={onEdit} />))
  return { host, unmount: () => act(() => root.unmount()) }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Mermaid block', () => {
  it('shows canvas placeholder for empty source and hides source by default', () => {
    const { host, unmount } = mount('')
    expect(host.textContent).toContain('Add diagram source')
    expect(host.querySelector('[contenteditable]')).toBeNull()
    unmount()
  })

  it('commits edited source after toggling source view', () => {
    const onEdit = vi.fn(() => true)
    const { host, unmount } = mount('flowchart LR\n  A --> B', onEdit)
    expect(host.querySelector('[contenteditable]')).toBeNull()
    const sourceToggle = host.querySelector<HTMLButtonElement>('.page-mermaid-toolbar button[title="Source"]')
    act(() => sourceToggle?.click())
    expect(host.querySelector('.page-mermaid-canvas')).toBeNull()
    expect(host.querySelector('.page-mermaid-source-panel')).not.toBeNull()
    const field = host.querySelector<HTMLElement>('[aria-label="Diagram Mermaid source"]')
    if (!field) throw new Error('mermaid field missing')
    act(() => {
      field.focus()
      field.textContent = 'sequenceDiagram'
      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(onEdit).toHaveBeenCalledWith('sequenceDiagram')
    unmount()
  })

  it('opens the canvas modal from expand', () => {
    const { host, unmount } = mount('flowchart LR\n  A --> B')
    act(() => host.querySelector<HTMLButtonElement>('.page-mermaid-block__expand')?.click())
    expect(document.querySelector('.page-mermaid-modal')).not.toBeNull()
    unmount()
  })
})
