import { describe, expect, it } from 'vitest'
import { parse, safeParse } from 'zod/v4/core'
import { breadcrumbSchema, breadcrumbTemplate, joinLabels, splitLabels } from './model'

describe('breadcrumb model', () => {
  it('template satisfies the schema', () =>
    expect(safeParse(breadcrumbSchema, breadcrumbTemplate()).success).toBe(true))

  it('keeps labels and optional hrefs, strips unknown keys', () => {
    expect(parse(breadcrumbSchema, { items: [{ label: 'Docs', href: 'https://x.dev', extra: 1 }] })).toEqual({
      items: [{ label: 'Docs', href: 'https://x.dev' }],
    })
  })

  it('rejects empty labels, non-array items and non-object props', () => {
    expect(safeParse(breadcrumbSchema, { items: [{ label: '' }] }).success).toBe(false)
    expect(safeParse(breadcrumbSchema, { items: 'nope' }).success).toBe(false)
    expect(safeParse(breadcrumbSchema, 'nope').success).toBe(false)
  })
})

describe('breadcrumb inline text', () => {
  it('round-trips labels through join/split', () => {
    const items = [{ label: 'Docs' }, { label: 'Guides' }, { label: 'Start' }]
    expect(splitLabels(joinLabels(items), items)).toEqual(items)
  })

  it('trims, drops empties and keeps a href only when its label is unchanged at the same position', () => {
    const previous = [{ label: 'A', href: 'https://a.dev' }, { label: 'B' }]
    expect(splitLabels(' Renamed /  / B ', previous)).toEqual([{ label: 'Renamed' }, { label: 'B' }])
    expect(splitLabels('A / B', previous)).toEqual([{ label: 'A', href: 'https://a.dev' }, { label: 'B' }])
    expect(splitLabels('B / A', previous)).toEqual([{ label: 'B' }, { label: 'A' }])
  })
})
