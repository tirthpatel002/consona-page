import { afterEach, describe, expect, it } from 'vitest'
import {
  createMemoryBlobStore,
  createMemoryStore,
  setSidecarStorage,
  type JsonObject,
  type SidecarStorage,
} from '../src/editor/core'
const DAY = 24 * 60 * 60 * 1000
import { countInlineFiles, migratePageFiles, scanOrphans, sweepOrphans } from './storageOps'

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const media = (attrs: Record<string, unknown>) => ({ type: 'media', attrs: { kind: 'image', ...attrs }, content: [] })
const doc = (...content: unknown[]): JsonObject => ({ type: 'doc', content }) as JsonObject

const memorySidecar = () => {
  const map = new Map<string, string>()
  const storage: SidecarStorage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
  return { map, storage }
}

describe('storage tools', () => {
  let restore: SidecarStorage | null = null
  afterEach(() => {
    if (restore) setSidecarStorage(restore)
    restore = null
  })
  const setup = () => {
    const sidecar = memorySidecar()
    restore = setSidecarStorage(sidecar.storage)
    return { pages: createMemoryStore(), blobs: createMemoryBlobStore(), sidecar }
  }

  it('counts inline files only', () => {
    expect(
      countInlineFiles(
        doc(media({ src: PNG }), media({ src: PNG, blob: 'blob:x' }), media({ src: 'https://a.test/x.png' })),
      ),
    ).toBe(1)
  })

  it('moves inline files into the store and saves once', async () => {
    const { pages, blobs } = setup()
    await pages.put('p', doc(media({ src: PNG })))
    const result = await migratePageFiles('p', { pages, blobs })
    expect(result).toMatchObject({ ok: true, migrated: 1, saved: true })
    expect(countInlineFiles((await pages.get('p'))?.doc)).toBe(0)
    expect(await blobs.list('p')).toHaveLength(1)
    expect((await pages.get('p'))?.revision).toBe(2)
  })

  it('does nothing and writes nothing when there is nothing to move', async () => {
    const { pages, blobs } = setup()
    await pages.put('p', doc(media({ src: 'https://a.test/x.png' })))
    expect(await migratePageFiles('p', { pages, blobs })).toMatchObject({ ok: true, migrated: 0, saved: false })
    expect((await pages.get('p'))?.revision).toBe(1)
  })

  it('a failed save leaves the page as it was and removes the files it just stored', async () => {
    const { pages, blobs } = setup()
    await pages.put('p', doc(media({ src: PNG })))
    const realPut = pages.put.bind(pages)
    pages.put = () => Promise.reject(new Error('disk full'))
    const result = await migratePageFiles('p', { pages, blobs })
    expect(result.ok).toBe(false)
    pages.put = realPut
    expect(countInlineFiles((await pages.get('p'))?.doc)).toBe(1)
    expect(await blobs.list('p')).toHaveLength(0)
  })

  it('a save elsewhere during the move is a conflict, not an overwrite', async () => {
    const { pages, blobs } = setup()
    await pages.put('p', doc(media({ src: PNG })))
    const realGet = pages.get.bind(pages)
    pages.get = async (id) => {
      const page = await realGet(id)
      await pages.put(id, doc(media({ src: PNG }), { type: 'paragraph' })) // another tab saves
      return page
    }
    const result = await migratePageFiles('p', { pages, blobs })
    expect(!result.ok && result.message).toMatch(/somewhere else/)
    pages.get = realGet
    expect(await blobs.list('p')).toHaveLength(0)
    expect(JSON.stringify((await pages.get('p'))?.doc)).toContain('paragraph')
  })

  it('finds unused files, keeps files a saved version still shows, and sweeps only unused ones', async () => {
    const { pages, blobs, sidecar } = setup()
    const keep = await blobs.put('p', new Blob(['a'], { type: 'image/png' }))
    const inVersion = await blobs.put('p', new Blob(['b'], { type: 'image/png' }))
    const unused = await blobs.put('p', new Blob(['c'], { type: 'image/png' }))
    await pages.put('p', doc(media({ blob: `blob:${keep.id}`, src: '' })))
    sidecar.map.set(
      'page:versions:p',
      JSON.stringify({ entries: [{ doc: doc(media({ blob: `blob:${inVersion.id}`, src: '' })) }], events: [] }),
    )
    const later = { now: () => Date.now() + 2 * DAY }
    expect(await scanOrphans('p', { pages, blobs, ...later })).toEqual({ ok: true, ids: [unused.id], recent: 0 })
    expect(await sweepOrphans('p', { pages, blobs, ...later })).toEqual({ ok: true, removed: 1 })
    expect((await blobs.list('p')).map((b) => b.id).sort()).toEqual([keep.id, inVersion.id].sort())
  })

  it('reports nothing and removes nothing when history or the body cannot be read', async () => {
    const { pages, blobs, sidecar } = setup()
    await blobs.put('p', new Blob(['c'], { type: 'image/png' }))
    await pages.put('p', doc())
    sidecar.map.set('page:versions:p', 'not json')
    const later = { now: () => Date.now() + 2 * DAY }
    expect((await scanOrphans('p', { pages, blobs, ...later })).ok).toBe(false)
    expect((await sweepOrphans('p', { pages, blobs, ...later })).ok).toBe(false)
    expect(await blobs.list('p')).toHaveLength(1)
    sidecar.map.delete('page:versions:p')
    expect((await scanOrphans('missing', { pages, blobs, ...later })).ok).toBe(true) // no body for that id: nothing refers to its files
    pages.get = () => Promise.reject(new Error('unreadable'))
    expect((await sweepOrphans('p', { pages, blobs, ...later })).ok).toBe(false)
    expect(await blobs.list('p')).toHaveLength(1)
  })

  it("a file another page shows stays: a block copied out of page A still refers to A's file until adoption", async () => {
    const { pages, blobs } = setup()
    const file = await blobs.put('a', new Blob(['x'], { type: 'image/png' }))
    await pages.put('a', doc())
    await pages.put('b', doc(media({ blob: `blob:${file.id}`, src: '' })))
    const later = { now: () => Date.now() + 2 * DAY }
    expect(await scanOrphans('a', { pages, blobs, ...later })).toEqual({ ok: true, ids: [], recent: 0 })
    expect(await sweepOrphans('a', { pages, blobs, ...later })).toEqual({ ok: true, removed: 0 })
    expect(await blobs.list('a')).toHaveLength(1)
  })

  it('keeps a page version of another page, and a trashed page, in the used set', async () => {
    const { pages, blobs, sidecar } = setup()
    const file = await blobs.put('a', new Blob(['x'], { type: 'image/png' }))
    await pages.put('a', doc())
    await pages.put('trashed', doc())
    sidecar.map.set(
      'page:versions:trashed',
      JSON.stringify({ entries: [{ doc: doc(media({ blob: `blob:${file.id}`, src: '' })) }], events: [] }),
    )
    const later = { now: () => Date.now() + 2 * DAY }
    expect(await scanOrphans('a', { pages, blobs, ...later })).toEqual({ ok: true, ids: [], recent: 0 })
  })

  it('never removes a file younger than a day, even when nothing refers to it, and says how many it kept', async () => {
    const { pages, blobs } = setup()
    await blobs.put('p', new Blob(['new'], { type: 'image/png' }))
    await pages.put('p', doc())
    expect(await scanOrphans('p', { pages, blobs })).toEqual({ ok: true, ids: [], recent: 1 })
    expect(await sweepOrphans('p', { pages, blobs })).toEqual({ ok: true, removed: 0 })
    expect(await blobs.list('p')).toHaveLength(1)
  })

  it('does not remove anything when the guard refuses', async () => {
    const { pages, blobs } = setup()
    await blobs.put('p', new Blob(['old'], { type: 'image/png' }))
    await pages.put('p', doc())
    const later = { now: () => Date.now() + 2 * DAY }
    const result = await sweepOrphans('p', { pages, blobs, ...later }, () =>
      Promise.resolve('Another tab has unsaved changes.'),
    )
    expect(result).toEqual({ ok: false, message: 'Another tab has unsaved changes.' })
    expect(await blobs.list('p')).toHaveLength(1)
  })
})
