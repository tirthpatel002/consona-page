import { describe, expect, it } from 'vitest'
import { createMemoryStore } from './memoryStore'
import { createMemoryRegistryStorage, createPageRegistry } from './registry'
import { searchPages, textBlocks } from './search'
import type { JsonObject } from '../json'

const para = (text: string, blockId?: string) => ({
  type: 'paragraph',
  attrs: { blockId },
  content: [{ type: 'text', text }],
})
const doc = (...content: object[]) => ({ type: 'doc', content }) as unknown as JsonObject

const setup = async () => {
  const pages = createMemoryStore()
  const registry = createPageRegistry({ storage: createMemoryRegistryStorage(), pages })
  return { pages, registry }
}

describe('textBlocks', () => {
  it('finds text in nested blocks with the nearest block id, and joins marked runs', () => {
    const d = doc(
      para('hello ', 'b1'),
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            attrs: { blockId: 'li' },
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'item' },
                  { type: 'text', text: ' two', marks: [{ type: 'bold' }] },
                ],
              },
            ],
          },
        ],
      },
      { type: 'paragraph' },
    )
    expect(textBlocks(d)).toEqual([
      { blockId: 'b1', text: 'hello ' },
      { blockId: 'li', text: 'item two' },
    ])
  })
})

describe('searchPages', () => {
  it('matches titles and bodies, folds case and accents, and reports the block id and the path', async () => {
    const { pages, registry } = await setup()
    const a = await registry.create({ title: 'Launch notes' })
    const b = await registry.create({ title: 'Café menu', parentId: a.id })
    await pages.put(a.id, doc(para('Rollout plan for Monday', 'x1')))
    await pages.put(b.id, doc(para('nothing here', 'y1')))
    const body = await searchPages({ registry, pages }, 'ROLLOUT')
    expect(body.results).toHaveLength(1)
    expect(body.results[0]).toMatchObject({ pageId: a.id, titleMatch: false, path: [] })
    expect(body.results[0]?.hits[0]).toMatchObject({ blockId: 'x1' })
    const title = await searchPages({ registry, pages }, 'cafe')
    expect(title.results[0]).toMatchObject({ pageId: b.id, titleMatch: true, path: ['Launch notes'], hits: [] })
  })

  it('skips trashed pages and their children, empty queries, and unreadable bodies', async () => {
    const { pages, registry } = await setup()
    const a = await registry.create({ title: 'A' })
    const child = await registry.create({ title: 'Child', parentId: a.id })
    await pages.put(child.id, doc(para('needle', 'c1')))
    expect((await searchPages({ registry, pages }, 'needle')).results).toHaveLength(1)
    await registry.moveToTrash(a.id)
    expect((await searchPages({ registry, pages }, 'needle')).results).toHaveLength(0)
    expect((await searchPages({ registry, pages }, '   ')).results).toEqual([])
    await registry.restore(a.id)
    const broken = { ...pages, get: () => Promise.reject(new Error('disk')) }
    const r = await searchPages({ registry, pages: broken }, 'child')
    expect(r.results.map((x) => x.title)).toEqual(['Child'])
  })

  it('bounds results, hits per page and pages read, and says when it stopped early', async () => {
    const { pages, registry } = await setup()
    for (let i = 0; i < 6; i++) {
      const p = await registry.create({ title: 'p' + String(i) })
      await pages.put(p.id, doc(para('word word', 'a'), para('word', 'b'), para('word', 'c')))
    }
    const limited = await searchPages({ registry, pages }, 'word', { limit: 2, hitsPerPage: 2 })
    expect(limited.results).toHaveLength(2)
    expect(limited.results[0]?.hits).toHaveLength(2)
    const capped = await searchPages({ registry, pages }, 'word', { maxPages: 3 })
    expect(capped.results).toHaveLength(3)
    expect(capped.truncated).toBe(true)
  })
})

describe('excerpts', () => {
  it('stay aligned after accented characters', async () => {
    const { pages, registry } = await setup()
    const a = await registry.create({ title: 'x' })
    await pages.put(a.id, doc(para('Crème brûlée et café: find the needle in this line', 'z')))
    const r = await searchPages({ registry, pages }, 'needle')
    expect(r.results[0]?.hits[0]?.excerpt).toContain('needle')
  })
})
