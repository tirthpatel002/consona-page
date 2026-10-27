// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  createIndexedDbRegistryStorage,
  createIndexedDbStore,
  createMemoryBlobStore,
  createMemoryRegistryStorage,
  createMemoryStore,
  createPageRegistry,
  RegistryError,
  type PageRegistry,
  type PageStore,
  type RegistryStorage,
} from './index'

const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
let n = 0
const makers: [string, () => { storage: RegistryStorage; pages: PageStore }][] = [
  ['memory', () => ({ storage: createMemoryRegistryStorage(), pages: createMemoryStore() })],
  [
    'indexedDB',
    () => {
      const name = `reg${String(++n)}`
      return { storage: createIndexedDbRegistryStorage({ name }), pages: createIndexedDbStore({ name }) }
    },
  ],
]
const titles = async (r: PageRegistry, parent: string | null) => (await r.children(parent)).map((p) => p.title)

describe.each(makers)('%s page registry', (_name, make) => {
  const setup = () => {
    const { storage, pages } = make()
    let t = 1000
    let i = 0
    const registry = createPageRegistry({ storage, pages, now: () => (t += 1), newId: () => `id${String(++i)}` })
    return { registry, pages, storage }
  }

  it('creates pages in order, at an index, under a parent', async () => {
    const { registry } = setup()
    const a = await registry.create({ title: 'A' })
    await registry.create({ title: 'B' })
    await registry.create({ title: 'first', index: 0 })
    const child = await registry.create({ title: 'child', parentId: a.id })
    expect(await titles(registry, null)).toEqual(['first', 'A', 'B'])
    expect(await titles(registry, a.id)).toEqual(['child'])
    expect((await registry.path(child.id)).map((p) => p.title)).toEqual(['A'])
  })

  it('create undo removes the page and restores sibling order', async () => {
    const { registry } = setup()
    await registry.create({ title: 'A' })
    const b = await registry.create({ title: 'B', index: 0 })
    expect(await titles(registry, null)).toEqual(['B', 'A'])
    await b.undo()
    expect(await titles(registry, null)).toEqual(['A'])
    expect(await registry.get(b.id)).toBeNull()
  })

  it('moves a page with its subtree, refuses a cycle, and undo puts it back', async () => {
    const { registry } = setup()
    const a = await registry.create({ title: 'A' })
    const b = await registry.create({ title: 'B' })
    const c = await registry.create({ title: 'C', parentId: a.id })
    const g = await registry.create({ title: 'G', parentId: c.id })
    const undo = await registry.move(a.id, b.id)
    expect(await titles(registry, b.id)).toEqual(['A'])
    expect((await registry.path(g.id)).map((p) => p.title)).toEqual(['B', 'A', 'C'])
    await expect(registry.move(b.id, g.id)).rejects.toMatchObject({ code: 'cycle' })
    await expect(registry.move(a.id, a.id)).rejects.toMatchObject({ code: 'cycle' })
    await undo.undo()
    expect(await titles(registry, null)).toEqual(['A', 'B'])
    expect(await titles(registry, a.id)).toEqual(['C'])
  })

  it('reorders among siblings by index', async () => {
    const { registry } = setup()
    const a = await registry.create({ title: 'A' })
    await registry.create({ title: 'B' })
    await registry.create({ title: 'C' })
    await registry.move(a.id, null, 2)
    expect(await titles(registry, null)).toEqual(['B', 'C', 'A'])
  })

  it('trash hides the whole subtree, keeps bodies, and restore brings it back under its parent', async () => {
    const { registry, pages } = setup()
    const a = await registry.create({ title: 'A' })
    const c = await registry.create({ title: 'C', parentId: a.id })
    await pages.put(c.id, doc('body of C'))
    const undo = await registry.moveToTrash(a.id)
    expect(await titles(registry, null)).toEqual([])
    expect(await registry.children(a.id)).toEqual([])
    expect((await registry.trash()).map((p) => p.title)).toEqual(['A'])
    expect((await pages.get(c.id))?.doc).toEqual(doc('body of C'))
    await expect(registry.create({ title: 'X', parentId: a.id })).rejects.toMatchObject({ code: 'parent_trashed' })
    await undo.undo()
    expect(await titles(registry, a.id)).toEqual(['C'])
    await registry.moveToTrash(c.id)
    await registry.moveToTrash(a.id)
    await registry.restore(c.id) // parent is trashed: comes back at the top level
    expect((await registry.get(c.id))?.parentId).toBeNull()
    await registry.restore(a.id)
    // C was restored first, so it sits before A (a restored page goes last among its siblings).
    expect(await titles(registry, null)).toEqual(['C', 'A'])
  })

  it('delete forever needs the trash, removes the subtree and every body, and is not undoable', async () => {
    const { registry, pages } = setup()
    const a = await registry.create({ title: 'A' })
    const c = await registry.create({ title: 'C', parentId: a.id })
    const keep = await registry.create({ title: 'Keep' })
    await pages.put(a.id, doc('a'))
    await pages.put(c.id, doc('c'))
    await pages.put(keep.id, doc('keep'))
    await expect(registry.deleteForever(a.id)).rejects.toMatchObject({ code: 'not_trashed' })
    await registry.moveToTrash(a.id)
    await registry.deleteForever(a.id)
    expect(await registry.get(a.id)).toBeNull()
    expect(await registry.get(c.id)).toBeNull()
    expect(await pages.get(a.id)).toBeNull()
    expect(await pages.get(c.id)).toBeNull()
    expect((await pages.get(keep.id))?.doc).toEqual(doc('keep'))
    expect(await titles(registry, null)).toEqual(['Keep'])
  })

  it('delete forever also removes the files of every deleted page and keeps other pages files', async () => {
    const { storage, pages } = setup()
    const blobs = createMemoryBlobStore()
    const registry = createPageRegistry({ storage, pages, blobs })
    const a = await registry.create({ title: 'A' })
    const c = await registry.create({ title: 'C', parentId: a.id })
    const keep = await registry.create({ title: 'Keep' })
    for (const id of [a.id, c.id, keep.id]) await blobs.put(id, new Blob(['x'], { type: 'image/png' }))
    await registry.moveToTrash(a.id)
    expect(await blobs.usage(a.id)).toBe(1) // trash keeps files
    await registry.deleteForever(a.id)
    expect(await blobs.usage(a.id)).toBe(0)
    expect(await blobs.usage(c.id)).toBe(0)
    expect(await blobs.usage(keep.id)).toBe(1)
  })

  it('a failed body delete keeps the records so the page is still in the trash', async () => {
    const { storage, pages } = setup()
    const failing: PageStore = { ...pages, remove: () => Promise.reject(new Error('disk')) }
    const registry = createPageRegistry({ storage, pages: failing })
    const a = await registry.create({ title: 'A' })
    await registry.moveToTrash(a.id)
    await expect(registry.deleteForever(a.id)).rejects.toThrow('disk')
    expect((await registry.trash()).map((p) => p.id)).toEqual([a.id])
  })

  it('rename validates and undoes; unknown ids are RegistryErrors', async () => {
    const { registry } = setup()
    const a = await registry.create({ title: 'A' })
    const undo = await registry.rename(a.id, 'Renamed')
    expect((await registry.get(a.id))?.title).toBe('Renamed')
    await undo.undo()
    expect((await registry.get(a.id))?.title).toBe('A')
    await expect(registry.rename(a.id, 'x'.repeat(501))).rejects.toBeInstanceOf(RegistryError)
    await expect(registry.rename('nope', 'x')).rejects.toMatchObject({ code: 'unknown_page' })
  })
})

describe('IndexedDB schema 2', () => {
  it('opens a version 1 database (pages only) and adds the registry without touching bodies', async () => {
    const name = 'upgrade-v1'
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(name, 1)
      open.onupgradeneeded = () => open.result.createObjectStore('pages', { keyPath: 'id' })
      open.onsuccess = () => {
        const tx = open.result.transaction('pages', 'readwrite')
        tx.objectStore('pages').put({ id: 'old', doc: doc('kept'), revision: 5, updatedAt: 1, format: 1 })
        tx.oncomplete = () => {
          open.result.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error ?? new Error('seed'))
      }
    })
    const pages = createIndexedDbStore({ name })
    expect((await pages.get('old'))?.revision).toBe(5)
    const registry = createPageRegistry({ storage: createIndexedDbRegistryStorage({ name }), pages })
    await registry.create({ title: 'New', id: 'new' })
    expect((await registry.children(null)).map((p) => p.id)).toEqual(['new'])
    expect((await pages.get('old'))?.doc).toEqual(doc('kept'))
  })
})
