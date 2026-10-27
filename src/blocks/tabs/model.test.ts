import { describe, expect, it } from 'vitest'
import { parse, safeParse } from 'zod/v4/core'
import { addTab, tabsSchema, tabsTemplate } from './model'

describe('tabs model', () => {
  it('template satisfies the schema', () => expect(safeParse(tabsSchema, tabsTemplate()).success).toBe(true))

  it('keeps id/title/body and strips unknown keys', () => {
    expect(parse(tabsSchema, { tabs: [{ id: 'a', title: 'T', body: 'B', extra: 1 }] })).toEqual({
      tabs: [{ id: 'a', title: 'T', body: 'B' }],
    })
  })

  it('rejects empty titles, empty ids, non-array tabs and non-object props', () => {
    expect(safeParse(tabsSchema, { tabs: [{ id: 'a', title: '', body: '' }] }).success).toBe(false)
    expect(safeParse(tabsSchema, { tabs: [{ id: '', title: 'T', body: '' }] }).success).toBe(false)
    expect(safeParse(tabsSchema, { tabs: 'nope' }).success).toBe(false)
    expect(safeParse(tabsSchema, 'nope').success).toBe(false)
  })

  it('addTab appends a numbered tab with a fresh id', () => {
    const tabs = tabsTemplate().tabs
    const next = addTab(tabs)
    expect(next).toHaveLength(tabs.length + 1)
    expect(next[next.length - 1]?.title).toBe(`Tab ${tabs.length + 1}`)
    expect(next.every((tab, i) => tabs.every((old, j) => i === j || tab.id !== old.id))).toBe(true)
  })
})
