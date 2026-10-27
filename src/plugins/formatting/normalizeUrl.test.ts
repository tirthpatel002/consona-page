import { describe, expect, it } from 'vitest'
import { normalizeUrl } from './normalizeUrl'

describe('normalizeUrl', () => {
  it('keeps safe schemes and adds https to bare hosts', () => {
    expect(normalizeUrl(' https://a.com ')).toBe('https://a.com')
    expect(normalizeUrl('mailto:a@b.co')).toBe('mailto:a@b.co')
    expect(normalizeUrl('example.com/x')).toBe('https://example.com/x')
    expect(normalizeUrl('#section')).toBe('#section')
  })
  it('rejects empty input and unsafe schemes', () => {
    expect(normalizeUrl('  ')).toBeNull()
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeUrl('data:text/html,x')).toBeNull()
  })
})
