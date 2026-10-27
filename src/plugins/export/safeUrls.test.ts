// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fromHtml } from './html'
import { fromMarkdown } from './markdown'
import { isSafeUrl, sanitizeImported } from './safeUrls'

describe('imported URL safety', () => {
  it('classifies URLs', () => {
    for (const ok of ['https://a.test/x', 'mailto:a@b.test', '/rel', 'page.html', 'data:image/png;base64,AAA'])
      expect(isSafeUrl(ok)).toBe(true)
    for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html;base64,AAA', 'vbscript:x', ''])
      expect(isSafeUrl(bad)).toBe(false)
  })

  it('drops unsafe links but keeps their text, and drops unsafe media', () => {
    const doc = sanitizeImported(
      fromHtml(
        '<p><a href="javascript:alert(1)">click</a> <a href="https://ok.test">ok</a></p><img src="javascript:x">',
      ),
    )
    const json = JSON.stringify(doc)
    expect(json).not.toContain('javascript:')
    expect(json).toContain('click')
    expect(json).toContain('https://ok.test')
    expect(JSON.stringify(sanitizeImported(fromMarkdown('[x](javascript:alert(1))')))).not.toContain('javascript:')
  })
})
