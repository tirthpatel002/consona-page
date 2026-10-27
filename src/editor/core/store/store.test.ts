// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createIndexedDbStore, createMemoryStore, StaleRevisionError, type PageStore } from './index'

const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })

let n = 0
const adapters: [string, () => PageStore][] = [
  ['memory', () => createMemoryStore()],
  ['indexedDB', () => createIndexedDbStore({ name: `t${String(++n)}` })],
]

describe.each(adapters)('%s page store', (_name, make) => {
  let store: PageStore
  beforeEach(() => {
    store = make()
  })

  it('returns null for an unknown id and stores one body per id', async () => {
    expect(await store.get('a')).toBeNull()
    const first = await store.put('a', doc('one'))
    expect(first.revision).toBe(1)
    const second = await store.put('a', doc('two'))
    expect(second.revision).toBe(2)
    expect((await store.get('a'))?.doc).toEqual(doc('two'))
    expect((await store.list()).map((p) => p.id)).toEqual(['a'])
  })

  it('keeps pages separate by id and removes only the one asked for', async () => {
    await store.put('a', doc('A'))
    await store.put('b', doc('B'))
    await store.remove('a')
    expect(await store.get('a')).toBeNull()
    expect((await store.get('b'))?.doc).toEqual(doc('B'))
  })

  it('rejects a write with a stale expected revision and writes nothing', async () => {
    await store.put('a', doc('one'))
    await expect(store.put('a', doc('x'), { expectedRevision: 0 })).rejects.toBeInstanceOf(StaleRevisionError)
    await expect(store.put('a', doc('x'), { expectedRevision: null })).rejects.toBeInstanceOf(StaleRevisionError)
    expect((await store.get('a'))?.doc).toEqual(doc('one'))
    const ok = await store.put('a', doc('two'), { expectedRevision: 1 })
    expect(ok.revision).toBe(2)
    expect((await store.put('new', doc('n'), { expectedRevision: null })).revision).toBe(1)
  })

  it('lets only one of two concurrent writers with the same expected revision win', async () => {
    await store.put('a', doc('base'))
    const results = await Promise.allSettled([
      store.put('a', doc('left'), { expectedRevision: 1 }),
      store.put('a', doc('right'), { expectedRevision: 1 }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await store.get('a'))?.revision).toBe(2)
  })
})

describe('IndexedDB legacy import', () => {
  it('imports a localStorage document once, leaves the old copy, and does not overwrite later saves', async () => {
    localStorage.setItem('page:doc:old', JSON.stringify(doc('legacy')))
    const store = createIndexedDbStore({ name: 'legacy-test', migrateLegacyLocalStorage: true })
    const first = await store.get('old')
    expect(first?.doc).toEqual(doc('legacy'))
    expect(first?.revision).toBe(1)
    expect(localStorage.getItem('page:doc:old')).not.toBeNull()
    await store.put('old', doc('newer'))
    expect((await store.get('old'))?.doc).toEqual(doc('newer'))
  })
  it('ignores unreadable legacy data', async () => {
    localStorage.setItem('page:doc:bad', '{not json')
    const store = createIndexedDbStore({ name: 'legacy-bad', migrateLegacyLocalStorage: true })
    expect(await store.get('bad')).toBeNull()
  })
})

describe('IndexedDB change feed across tabs', () => {
  it('tells a second connection to the same database about writes and removals, once each', async () => {
    const a = createIndexedDbStore({ name: 'feed-test' })
    const b = createIndexedDbStore({ name: 'feed-test' })
    const heard: unknown[] = []
    b.subscribe?.((change) => heard.push(change))
    const own: unknown[] = []
    a.subscribe?.((change) => own.push(change))
    await a.put('p', doc('x'))
    await a.remove('p')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(heard).toEqual([
      { id: 'p', revision: 1 },
      { id: 'p', revision: null },
    ])
    expect(own).toEqual(heard)
  })
})
