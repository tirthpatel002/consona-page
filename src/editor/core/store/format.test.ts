// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createIndexedDbStore,
  createLocalStorageStore,
  FORMAT_VERSION,
  isQuotaError,
  migrateStoredPage,
  StorageQuotaError,
  UnsupportedFormatError,
} from './index'

const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })

const putRaw = (name: string, record: object) =>
  new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(name, 1)
    open.onupgradeneeded = () => open.result.createObjectStore('pages', { keyPath: 'id' })
    open.onsuccess = () => {
      const tx = open.result.transaction('pages', 'readwrite')
      tx.objectStore('pages').put(record)
      tx.oncomplete = () => {
        open.result.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error ?? new Error('put failed'))
    }
  })

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('stored page format', () => {
  it('upgrades a record without a format field and keeps its content and revision', () => {
    const page = migrateStoredPage({ id: 'a', doc: doc('x'), revision: 4, updatedAt: 9 })
    expect(page).toEqual({ id: 'a', doc: doc('x'), revision: 4, updatedAt: 9, format: FORMAT_VERSION })
  })

  it('refuses a newer or invalid format instead of guessing', () => {
    expect(() =>
      migrateStoredPage({ id: 'a', doc: doc('x'), revision: 1, updatedAt: 0, format: FORMAT_VERSION + 1 }),
    ).toThrow(UnsupportedFormatError)
    expect(() => migrateStoredPage({ id: 'a', doc: doc('x'), revision: 1, updatedAt: 0, format: -1 })).toThrow(
      UnsupportedFormatError,
    )
  })

  it('IndexedDB: reads an old record as the current format; writes stamp the format', async () => {
    await putRaw('fmt-old', { id: 'p', doc: doc('old'), revision: 3, updatedAt: 1 })
    const store = createIndexedDbStore({ name: 'fmt-old' })
    const read = await store.get('p')
    expect(read?.format).toBe(FORMAT_VERSION)
    expect(read?.revision).toBe(3)
    const written = await store.put('p', doc('new'), { expectedRevision: 3 })
    expect(written.format).toBe(FORMAT_VERSION)
  })

  it('IndexedDB: a page from a newer version is not opened and is not overwritten', async () => {
    await putRaw('fmt-new', { id: 'p', doc: doc('future'), revision: 2, updatedAt: 1, format: FORMAT_VERSION + 1 })
    const store = createIndexedDbStore({ name: 'fmt-new' })
    await expect(store.get('p')).rejects.toBeInstanceOf(UnsupportedFormatError)
    await expect(store.put('p', doc('clobber'))).rejects.toBeInstanceOf(UnsupportedFormatError)
    const raw = await new Promise<{ doc: unknown }>((resolve) => {
      const open = indexedDB.open('fmt-new', 1)
      open.onsuccess = () => {
        const get = open.result.transaction('pages').objectStore('pages').get('p')
        get.onsuccess = () => resolve(get.result as { doc: unknown })
      }
    })
    expect(raw.doc).toEqual(doc('future'))
  })

  it('localStorage: old documents read as the current format; a newer one is refused and kept', async () => {
    localStorage.setItem('page:doc:a', JSON.stringify(doc('old')))
    const store = createLocalStorageStore()
    expect((await store.get('a'))?.format).toBe(FORMAT_VERSION)
    localStorage.setItem('page:doc-format:a', String(FORMAT_VERSION + 1))
    await expect(store.get('a')).rejects.toBeInstanceOf(UnsupportedFormatError)
    await expect(store.put('a', doc('clobber'))).rejects.toBeInstanceOf(UnsupportedFormatError)
    expect(JSON.parse(localStorage.getItem('page:doc:a') ?? '{}')).toEqual(doc('old'))
  })
})

describe('storage quota', () => {
  const quota = () => new DOMException('full', 'QuotaExceededError')

  it('recognises the browser variants', () => {
    expect(isQuotaError(quota())).toBe(true)
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true)
    expect(isQuotaError({ code: 22 })).toBe(true)
    expect(isQuotaError(new Error('other'))).toBe(false)
  })

  it('localStorage: a full storage rejects with StorageQuotaError and leaves the previous copy and revision', async () => {
    const store = createLocalStorageStore()
    await store.put('a', doc('one'))
    const real = Storage.prototype.setItem
    let calls = 0
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      calls += 1
      // Body write succeeds, revision write fails: the worst half-written case.
      if (calls === 2) throw quota()
      real.call(this, key, value)
    })
    await expect(store.put('a', doc('two'), { expectedRevision: 1 })).rejects.toBeInstanceOf(StorageQuotaError)
    vi.restoreAllMocks()
    const after = await store.get('a')
    expect(after?.revision).toBe(1)
    expect(after?.doc).toEqual(doc('one'))
  })

  it('IndexedDB: a quota failure on commit rejects with StorageQuotaError', async () => {
    const store = createIndexedDbStore({ name: 'quota-idb' })
    await store.put('a', doc('one'))
    const put = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value: unknown) {
      this.transaction.abort()
      throw quota()
      return put.call(this, value)
    })
    await expect(store.put('a', doc('two'))).rejects.toBeInstanceOf(StorageQuotaError)
    vi.restoreAllMocks()
    expect((await store.get('a'))?.doc).toEqual(doc('one'))
  })
})
