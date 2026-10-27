import { describe, expect, it } from 'vitest'
import { breadcrumbSchema } from './model'

describe('breadcrumb link targets', () => {
  it('rejects a javascript: href and accepts https', () => {
    expect(breadcrumbSchema.safeParse({ items: [{ label: 'a', href: 'javascript:alert(1)' }] }).success).toBe(false)
    expect(breadcrumbSchema.safeParse({ items: [{ label: 'a', href: 'https://example.com' }] }).success).toBe(true)
  })
})
