/**
 * Small per-page records that sit next to the body: version history and comment threads. Reads are
 * synchronous (the stores load in constructors), writes may fail and must throw so callers can report that
 * the data is not durable.
 */
export interface SidecarStorage {
  getItem(key: string): string | null
  /** Throws when the value could not be accepted (for example quota). */
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const localStorageSidecar: SidecarStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
}

let current: SidecarStorage = localStorageSidecar

/** The storage history and comments use. Defaults to localStorage, as before. */
export const getSidecarStorage = (): SidecarStorage => current
/** Host-level switch, set once before the editor mounts. Returns the previous storage. */
export const setSidecarStorage = (storage: SidecarStorage | null): SidecarStorage => {
  const previous = current
  current = storage ?? localStorageSidecar
  return previous
}

export interface IndexedDbSidecar extends SidecarStorage {
  /** Loads every record into memory and imports older localStorage copies once. Call before mounting. */
  ready(): Promise<void>
  /** Resolves when all pending writes have been stored. Rejects with the first write failure since the last flush. */
  flush(): Promise<void>
  /** Called when a background write fails, so the host can show that the data is not durable. */
  onWriteError?: (error: unknown) => void
}

const STORE = 'records'
const IMPORTED = '__imported:'

/**
 * Keeps records in IndexedDB (its own small database, separate from page bodies and files). Reads come
 * from memory after `ready()`. A write updates memory at once and is stored in the background, so a failed
 * background write is reported through `onWriteError` and `flush()` instead of throwing from `setItem`.
 * Records found only in localStorage are copied in once per key and the localStorage copy is left in place.
 */
export function createIndexedDbSidecar(
  options: { readonly name?: string; readonly legacyPrefixes?: readonly string[] } = {},
): IndexedDbSidecar {
  const { name = 'page-sidecar', legacyPrefixes = ['page:versions:', 'page:comments:'] } = options
  const cache = new Map<string, string>()
  let pending: Promise<void> = Promise.resolve()
  let failure: unknown = null
  let opened: Promise<IDBDatabase> | null = null
  const open = (): Promise<IDBDatabase> => {
    opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened'))
      request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'))
    })
    return opened
  }
  const run = <T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore) => IDBRequest<T> | undefined,
  ): Promise<T | undefined> =>
    open().then(
      (db) =>
        new Promise<T | undefined>((resolve, reject) => {
          const tx = db.transaction(STORE, mode)
          const request = work(tx.objectStore(STORE))
          tx.oncomplete = () => resolve(request ? request.result : undefined)
          tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
          tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write was aborted'))
        }),
    )
  const sidecar: IndexedDbSidecar = {
    getItem: (key) => cache.get(key) ?? null,
    setItem(key, value) {
      cache.set(key, value)
      enqueue(() =>
        run('readwrite', (s) => {
          s.put(value, key)
          return undefined
        }),
      )
    },
    removeItem(key) {
      cache.delete(key)
      enqueue(() =>
        run('readwrite', (s) => {
          s.delete(key)
          return undefined
        }),
      )
    },
    async ready() {
      await run('readonly', (s) => {
        const keys = s.getAllKeys()
        const values = s.getAll()
        keys.onsuccess = () =>
          (values.onsuccess = () => keys.result.forEach((k, i) => cache.set(String(k), String(values.result[i]))))
        return undefined
      })
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (!key || !legacyPrefixes.some((p) => key.startsWith(p))) continue
          if (cache.has(key) || cache.has(IMPORTED + key)) continue
          const value = localStorage.getItem(key)
          if (value === null) continue
          cache.set(key, value)
          cache.set(IMPORTED + key, '1')
          const k = key
          enqueue(() =>
            run('readwrite', (s) => {
              s.put(value, k)
              s.put('1', IMPORTED + k)
              return undefined
            }),
          )
        }
      } catch {
        // localStorage unavailable: nothing to import
      }
      await sidecar.flush()
    },
    async flush() {
      await pending
      if (failure !== null) {
        const error = failure
        failure = null
        throw error
      }
    },
  }
  function enqueue(job: () => Promise<unknown>): void {
    pending = pending.then(job).then(
      () => undefined,
      (error: unknown) => {
        failure ??= error
        sidecar.onWriteError?.(error)
      },
    )
  }
  return sidecar
}
