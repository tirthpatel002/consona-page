// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fromHtml } from './html'
import { sanitizeImported } from './safeUrls'

const hostile =
  '<h1 onclick="alert(1)">Title</h1>' +
  '<script>alert("x")</script><iframe src="https://evil.test"></iframe><object data="x"></object>' +
  '<style>body{background:url(javascript:alert(1))}</style>' +
  '<p style="background:url(javascript:1)" onmouseover="alert(2)">Keep <b>this</b> text</p>' +
  '<img src="x" onerror="alert(3)"><form action="https://evil.test"><input name="a"></form>' +
  '<svg onload="alert(4)"><script>alert(5)</script></svg>'

describe('imported HTML active content', () => {
  const json = JSON.stringify(sanitizeImported(fromHtml(hostile)))

  it('carries no script, handler, frame, style or form content', () => {
    for (const bad of [
      'alert',
      'onclick',
      'onerror',
      'onload',
      'evil.test',
      'iframe',
      'script',
      'javascript',
      'background',
    ])
      expect(json).not.toContain(bad)
  })

  it('keeps ordinary text', () => {
    expect(json).toContain('Title')
    expect(json).toContain('Keep')
    expect(json).toContain('this')
  })
})
