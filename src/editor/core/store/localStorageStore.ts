import type { JsonObject } from '../json'
import { assertRevision } from './memoryStore'
import type { PageStore, PageSummary, PutOptions, StoredPage } from './types'

const PREFIX = 'page:doc:'
const REV_PREFIX = 'page:doc-rev:'

/**
 * Pages in localStorage, in the original format (`page:doc:<id>` holds the bare document), with the
 * revision kept beside it. Small quota and synchronous: the fallback when IndexedDB is unavailable.
 * A document saved before revisions existed counts as revision 1.
 */
export function createLocalStorageStore(now: () => number = Date.now): PageStore {
  const read = (id: string): StoredPage | null => {
    const raw = localStorage.getItem(PREFIX + id)
    if (raw === null) return null
    try {
      const doc = JSON.parse(raw) as unknown
      if (typeof doc !== 'object' || doc === null || (doc as { type?: unknown }).type !== 'doc') return null
      const revision = Number(localStorage.getItem(REV_PREFIX + id))
      return {
        id,
        doc: doc as JsonObject,
        revision: Number.isInteger(revision) && revision > 0 ? revision : 1,
        updatedAt: 0,
      }
    } catch {
      return null
    }
  }
  const run = <T>(fn: () => T): Promise<T> => {
    try {
      return Promise.resolve(fn())
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)))
    }
  }
  return {
    get: (id) => run(() => read(id)),
    put: (id: string, doc: JsonObject, options?: PutOptions) =>
      run(() => {
        const current = read(id)
        assertRevision(id, current, options)
        const next: StoredPage = { id, doc, revision: (current?.revision ?? 0) + 1, updatedAt: now() }
        localStorage.setItem(PREFIX + id, JSON.stringify(doc))
        localStorage.setItem(REV_PREFIX + id, String(next.revision))
        return next
      }),
    remove: (id) =>
      run(() => {
        localStorage.removeItem(PREFIX + id)
        localStorage.removeItem(REV_PREFIX + id)
      }),
    list: () =>
      run(() => {
        const out: PageSummary[] = []
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i)
          if (!key?.startsWith(PREFIX)) continue
          const page = read(key.slice(PREFIX.length))
          if (page) out.push({ id: page.id, revision: page.revision, updatedAt: page.updatedAt })
        }
        return out
      }),
  }
}
