import type { JsonObject } from '../json'
import { createChangeFeed } from './changeFeed'
import { asStorageError, FORMAT_VERSION, migrateStoredPage } from './format'
import { assertRevision } from './memoryStore'
import type { PageRecord, RegistryStorage } from './registry'
import type { PageStore, PageSummary, PutOptions, StoredPage } from './types'

export interface IndexedDbStoreOptions {
  /** Database name. Default "page-store". */
  readonly name?: string
  readonly now?: () => number
  /**
   * Import a document saved by the earlier localStorage format (`page:doc:<id>`) the first time an id
   * is read and nothing is stored for it. The old copy is left in place, so a downgrade still works.
   */
  readonly migrateLegacyLocalStorage?: boolean | ((id: string) => boolean)
}

const STORE = 'pages'
/** Bump when the object layout changes and add a step to `upgrade`. */
export const SCHEMA_VERSION = 2
const REGISTRY = 'registry'

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })

const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })

function upgrade(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) db.createObjectStore(STORE, { keyPath: 'id' })
  // 2: the page tree (parents, titles, order, trash). Bodies stay in `pages`.
  if (oldVersion < 2) db.createObjectStore(REGISTRY, { keyPath: 'id' })
}

function readLegacy(id: string): JsonObject | null {
  try {
    const raw = JSON.parse(localStorage.getItem(`page:doc:${id}`) ?? 'null') as unknown
    if (typeof raw === 'object' && raw !== null && (raw as { type?: unknown }).type === 'doc') return raw as JsonObject
  } catch {
    // Unreadable legacy data is treated as absent.
  }
  return null
}

/** Pages in IndexedDB: larger quota than localStorage, atomic revision-checked writes. */
export function createIndexedDbStore(options: IndexedDbStoreOptions = {}): PageStore {
  const { name = 'page-store', now = Date.now, migrateLegacyLocalStorage = false } = options
  let opened: Promise<IDBDatabase> | null = null
  const feed = createChangeFeed(`page-store:${name}`)
  const open = (): Promise<IDBDatabase> => {
    opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name, SCHEMA_VERSION)
      req.onupgradeneeded = (event) => upgrade(req.result, event.oldVersion)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('Could not open the page database'))
      req.onblocked = () => reject(new Error('The page database is blocked by another tab'))
    })
    opened.catch(() => {
      opened = null
    })
    return opened
  }

  const write = async (id: string, doc: JsonObject, put: PutOptions | undefined): Promise<StoredPage> => {
    const db = await open()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const current = (await request(store.get(id))) as StoredPage | undefined
    try {
      if (current) migrateStoredPage(current)
      assertRevision(id, current, put)
    } catch (error) {
      tx.abort()
      await done(tx).catch(() => undefined)
      throw error
    }
    const next: StoredPage = {
      id,
      doc,
      format: FORMAT_VERSION,
      revision: (current?.revision ?? 0) + 1,
      updatedAt: now(),
    }
    try {
      store.put(next)
      await done(tx)
    } catch (error) {
      throw asStorageError(error)
    }
    feed.publish({ id, revision: next.revision })
    return next
  }

  return {
    subscribe: feed.subscribe,
    async get(id) {
      const db = await open()
      const found = (await request(db.transaction(STORE).objectStore(STORE).get(id))) as StoredPage | undefined
      if (found) return migrateStoredPage(found)
      if (typeof migrateLegacyLocalStorage === 'function' ? !migrateLegacyLocalStorage(id) : !migrateLegacyLocalStorage)
        return null
      const legacy = readLegacy(id)
      // Only import when still absent: a concurrent write wins over the old copy.
      return legacy ? write(id, legacy, { expectedRevision: null }).catch(() => this.get(id)) : null
    },
    put: (id, doc, putOptions) => write(id, doc, putOptions),
    async remove(id) {
      const db = await open()
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      await done(tx)
      feed.publish({ id, revision: null })
    },
    async list() {
      const db = await open()
      const all = (await request(db.transaction(STORE).objectStore(STORE).getAll())) as StoredPage[]
      return all.map(({ id, revision, updatedAt }): PageSummary => ({ id, revision, updatedAt }))
    },
  }
}

/** Page-tree records in the same database as the page bodies (object store `registry`). Each write is one transaction. */
export function createIndexedDbRegistryStorage(options: { readonly name?: string } = {}): RegistryStorage {
  const { name = 'page-store' } = options
  let opened: Promise<IDBDatabase> | null = null
  const open = (): Promise<IDBDatabase> => {
    opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name, SCHEMA_VERSION)
      req.onupgradeneeded = (event) => upgrade(req.result, event.oldVersion)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('Could not open the page database'))
      req.onblocked = () => reject(new Error('The page database is blocked by another tab'))
    })
    opened.catch(() => {
      opened = null
    })
    return opened
  }
  return {
    async list() {
      const db = await open()
      return (await request(db.transaction(REGISTRY).objectStore(REGISTRY).getAll())) as PageRecord[]
    },
    async putMany(records) {
      const db = await open()
      const tx = db.transaction(REGISTRY, 'readwrite')
      try {
        for (const record of records) tx.objectStore(REGISTRY).put(record)
        await done(tx)
      } catch (error) {
        throw asStorageError(error)
      }
    },
    async removeMany(ids) {
      const db = await open()
      const tx = db.transaction(REGISTRY, 'readwrite')
      for (const id of ids) tx.objectStore(REGISTRY).delete(id)
      await done(tx)
    },
  }
}
