// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { BlobLimitError, createIndexedDbBlobStore, createMemoryBlobStore, type BlobStore } from './index'

const file = (size: number, type = 'image/png') => new Blob([new Uint8Array(size)], { type })
let n = 0
const makers: [string, (limits: { maxFileBytes: number; maxPageBytes: number }) => BlobStore][] = [
  ['memory', (limits) => createMemoryBlobStore({ limits })],
  ['indexedDB', (limits) => createIndexedDbBlobStore({ name: `blobs${String(++n)}`, limits })],
]

describe.each(makers)('%s blob store', (_name, make) => {
  const store = () => make({ maxFileBytes: 100, maxPageBytes: 250 })

  it('stores a file by page, returns it by id, and reports size and usage', async () => {
    const s = store()
    const a = await s.put('p1', file(40))
    await s.put('p2', file(30))
    expect(a).toMatchObject({ pageId: 'p1', type: 'image/png', size: 40 })
    const got = await s.get(a.id)
    expect(got?.size).toBe(40)
    expect(got?.type).toBe('image/png')
    expect(await s.usage('p1')).toBe(40)
    expect((await s.list('p1')).map((b) => b.id)).toEqual([a.id])
    expect(await s.get('missing')).toBeNull()
  })

  it('refuses a file over the per-file limit, a type outside the list, and a page over its total, storing nothing', async () => {
    const s = store()
    await expect(s.put('p', file(101))).rejects.toMatchObject({ code: 'too_large', limit: 100 })
    await expect(s.put('p', file(10, 'application/x-msdownload'))).rejects.toBeInstanceOf(BlobLimitError)
    await s.put('p', file(100))
    await s.put('p', file(100))
    await expect(s.put('p', file(60))).rejects.toMatchObject({ code: 'page_limit', limit: 250 })
    expect(await s.usage('p')).toBe(200)
    // another page has its own total
    await s.put('q', file(100))
    expect(await s.usage('q')).toBe(100)
  })

  it('replacing an id counts only the new size, and remove and removePage free the space', async () => {
    const s = store()
    const a = await s.put('p', file(100))
    await s.put('p', file(100))
    await s.put('p', file(90), { id: a.id }) // replaces a: 90 + 100 = 190, fits
    expect(await s.usage('p')).toBe(190)
    await s.remove(a.id)
    expect(await s.usage('p')).toBe(100)
    await s.removePage('p')
    expect(await s.usage('p')).toBe(0)
    expect(await s.list('p')).toEqual([])
  })
})
