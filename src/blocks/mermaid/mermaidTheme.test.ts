// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { applyMermaidPageTheme } from './mermaidTheme'

describe('applyMermaidPageTheme', () => {
  it('does not throw when page tokens use oklch', () => {
    document.documentElement.style.setProperty('--page-muted', 'oklch(0.942 0.006 85)')
    expect(() => applyMermaidPageTheme()).not.toThrow()
  })
})
