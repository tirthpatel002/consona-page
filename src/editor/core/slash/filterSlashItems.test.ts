import { describe, expect, it } from 'vitest'
import { filterSlashItems } from './filterSlashItems'
import type { SlashItem } from './types'

const item = (id: string, title: string, group = 'Blocks', keywords: string[] = []): SlashItem => ({
  id,
  title,
  group,
  keywords,
  run: () => undefined,
})

const items = [
  item('h1', 'Heading 1', 'Text', ['h1', 'title']),
  item('bar', 'Bar chart', 'Blocks', ['graph']),
  item('line', 'Line chart', 'Blocks', ['graph', 'trend']),
  item('table', 'Data table', 'Blocks', ['grid']),
]

const ids = (query: string) => filterSlashItems(items, query).map((i) => i.id)

describe('filterSlashItems', () => {
  it('returns everything for an empty query', () => expect(ids('')).toEqual(['h1', 'bar', 'line', 'table']))
  it('ranks title prefix before word prefix', () => expect(ids('ta')).toEqual(['table']))
  it('matches word prefixes in titles', () => expect(ids('chart')).toEqual(['bar', 'line']))
  it('matches keywords and groups', () => {
    expect(ids('graph')).toEqual(['bar', 'line'])
    expect(ids('text')).toEqual(['h1'])
  })
  it('is case- and punctuation-insensitive', () => expect(ids('LINE-ch')).toEqual(['line']))
  it('falls back to substrings and excludes non-matches', () => {
    expect(ids('rend')).toEqual(['line'])
    expect(ids('zzz')).toEqual([])
  })
  it('respects the limit', () => expect(filterSlashItems(items, '', 2)).toHaveLength(2))
})
