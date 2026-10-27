import type { JSONContent } from '@tiptap/core'
import { createIndexedDbStore, createLocalStorageStore, type PageStore } from '../src/editor/core'
import type { PersistenceSession } from '../src/plugins/persistence'

/**
 * The demo saves to IndexedDB (and imports an earlier localStorage copy once). When IndexedDB is not
 * available or cannot be opened, it saves to localStorage instead, in the original format.
 */
export const demoSession: PersistenceSession = {
  store:
    typeof indexedDB === 'undefined'
      ? createLocalStorageStore()
      : createIndexedDbStore({ migrateLegacyLocalStorage: true }),
  revision: undefined,
}

export interface LoadedPage {
  readonly content: JSONContent | null
}

/** Loads the page and records its revision on the session. Falls back to localStorage once if the first store fails. */
export async function loadDemoPage(documentId: string): Promise<LoadedPage> {
  const attempt = async (store: PageStore): Promise<LoadedPage> => {
    const found = await store.get(documentId)
    demoSession.store = store
    demoSession.revision = found ? found.revision : null
    return { content: found ? (found.doc as JSONContent) : null }
  }
  try {
    return await attempt(demoSession.store)
  } catch (first) {
    try {
      return await attempt(createLocalStorageStore())
    } catch {
      throw first
    }
  }
}
