import type { JSONContent } from '@tiptap/core'
import { createIndexedDbStore, createLocalStorageStore, type PageStore } from '../src/editor/core'
import type { PersistenceSession } from '../src/plugins/persistence'

/**
 * The demo saves to IndexedDB (and imports an earlier localStorage copy once). When IndexedDB is not
 * available or cannot be opened for a page that never lived there, it saves to localStorage instead,
 * in the original format.
 */
const localStore = createLocalStorageStore()
const indexedDbStore: PageStore | null =
  typeof indexedDB === 'undefined' ? null : createIndexedDbStore({ migrateLegacyLocalStorage: true })

export const demoSession: PersistenceSession = { store: indexedDbStore ?? localStore, revision: undefined }

export interface LoadedPage {
  readonly content: JSONContent | null
}

const authorityKey = (id: string) => `page:store-authority:${id}`

export interface LoadDeps {
  readonly primary: PageStore | null
  readonly fallback: PageStore
  readonly session: PersistenceSession
}

/**
 * Loads the page and records the store and revision on the session. Once the primary store (IndexedDB)
 * has held a page it is the only authority for it: if it fails later, the page does not open from the
 * older localStorage copy, because editing that copy and recovering IndexedDB later would overwrite
 * newer content. Before that, a failed primary falls back once.
 */
export async function loadPage(documentId: string, deps: LoadDeps): Promise<LoadedPage> {
  const { primary, fallback, session } = deps
  const usedPrimary = (() => {
    try {
      return localStorage.getItem(authorityKey(documentId)) === 'indexeddb'
    } catch {
      return false
    }
  })()
  const attempt = async (store: PageStore): Promise<LoadedPage> => {
    const found = await store.get(documentId)
    session.store = store
    session.revision = found ? found.revision : null
    return { content: found ? (found.doc as JSONContent) : null }
  }
  if (primary) {
    try {
      const loaded = await attempt(primary)
      try {
        localStorage.setItem(authorityKey(documentId), 'indexeddb')
      } catch {
        // Without the marker a later primary failure may fall back; the page itself is unaffected.
      }
      return loaded
    } catch (error) {
      if (usedPrimary) throw error
    }
  } else if (usedPrimary) {
    throw new Error('This page was saved in IndexedDB, which is not available now.')
  }
  return attempt(fallback)
}

export const loadDemoPage = (documentId: string): Promise<LoadedPage> =>
  loadPage(documentId, { primary: indexedDbStore, fallback: localStore, session: demoSession })
