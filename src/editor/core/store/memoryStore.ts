import type { JsonObject } from '../json'
import { StaleRevisionError, type PageStore, type PageSummary, type PutOptions, type StoredPage } from './types'

/** Check shared by every adapter: throws StaleRevisionError when the precondition fails. */
export function assertRevision(id: string, current: StoredPage | null | undefined, options?: PutOptions): void {
  if (!options || options.expectedRevision === undefined) return
  const actual = current ? current.revision : null
  if (actual !== options.expectedRevision) throw new StaleRevisionError(id, options.expectedRevision, actual)
}

/** In-memory adapter: for tests, previews and hosts that persist elsewhere. */
export function createMemoryStore(now: () => number = Date.now): PageStore {
  const pages = new Map<string, StoredPage>()
  return {
    get: (id) => Promise.resolve(pages.get(id) ?? null),
    put(id: string, doc: JsonObject, options?: PutOptions) {
      try {
        const current = pages.get(id)
        assertRevision(id, current, options)
        const next: StoredPage = {
          id,
          doc: structuredClone(doc),
          revision: (current?.revision ?? 0) + 1,
          updatedAt: now(),
        }
        pages.set(id, next)
        return Promise.resolve(next)
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)))
      }
    },
    remove: (id) => {
      pages.delete(id)
      return Promise.resolve()
    },
    list: () =>
      Promise.resolve(
        [...pages.values()].map(({ id, revision, updatedAt }): PageSummary => ({ id, revision, updatedAt })),
      ),
  }
}
