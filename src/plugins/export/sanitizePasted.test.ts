// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { sanitizePastedHtml } from './safeUrls'

describe('sanitizePastedHtml', () => {
  it('removes active elements, handlers and unsafe URLs', () => {
    const out = sanitizePastedHtml(
      '<div data-pm-slice="0 0 []"><p onclick="x()" style="background:url(javascript:1)">a<a href="javascript:1">l</a></p>' +
        '<script>s()</script><iframe src="https://e.test"></iframe><img src="data:text/html;base64,AAAA" onerror="y()"></div>',
    )
    expect(out).not.toMatch(/onclick|onerror|script|iframe|javascript|url\(|data:text/i)
    expect(out).toContain('data-pm-slice')
  })
  it('keeps safe links, colors and editor data attributes', () => {
    const out = sanitizePastedHtml(
      '<p style="color: red"><a href="https://example.com">x</a></p><div data-props=\'{"a":1}\' data-embed-block="1"></div>',
    )
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('color: red')
    expect(out).toContain('data-embed-block')
  })
})
