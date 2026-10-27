import type { JSONContent } from '@tiptap/core'
import { createIndexedDbStore, createLocalStorageStore, type PageStore } from '../src/editor/core'
import type { PersistenceSession } from '../src/plugins/persistence'

/**
 * The demo saves to IndexedDB (and imports an earlier localStorage copy once). When IndexedDB is not
 * available or cannot be opened for a page that never lived there, it saves to localStorage instead,
 * in the original format.
 */
const authorityKey = (id: string) => `page:store-authority:${id}`
function hasPrimaryAuthority(id: string): boolean {
  try {
    return localStorage.getItem(authorityKey(id)) === 'indexeddb'
  } catch {
    return false
  }
}

const localStore = createLocalStorageStore()
const indexedDbStore: PageStore | null =
  typeof indexedDB === 'undefined'
    ? null
    : createIndexedDbStore({ migrateLegacyLocalStorage: (id) => !hasPrimaryAuthority(id) })

export const demoSession: PersistenceSession = { store: indexedDbStore ?? localStore, revision: undefined }

export interface LoadedPage {
  readonly content: JSONContent | null
}

/** The primary store held this page before and no longer has it. */
export class MissingPageError extends Error {
  constructor(readonly documentId: string) {
    super("The saved page is missing from this browser's database.")
    this.name = 'MissingPageError'
  }
}

/** Explicit recovery choices after a MissingPageError. Each one is chosen by the user, never automatic. */
export async function openOlderLocalCopy(documentId: string): Promise<LoadedPage | null> {
  const found = await localStore.get(documentId)
  return found ? { content: found.doc as JSONContent } : null
}

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
  const usedPrimary = hasPrimaryAuthority(documentId)
  const attempt = async (store: PageStore): Promise<LoadedPage> => {
    const found = await store.get(documentId)
    session.store = store
    session.revision = found ? found.revision : null
    return { content: found ? (found.doc as JSONContent) : null }
  }
  if (primary) {
    try {
      const loaded = await attempt(primary)
      if (usedPrimary && loaded.content === null) {
        // IndexedDB held this page before and now has no record: surface it, never reopen an older copy silently.
        throw new MissingPageError(documentId)
      }
      try {
        localStorage.setItem(authorityKey(documentId), 'indexeddb')
      } catch {
        // Without the marker a later primary failure may fall back; the page itself is unaffected.
      }
      return loaded
    } catch (error) {
      if (usedPrimary || error instanceof MissingPageError) throw error
    }
  } else if (usedPrimary) {
    throw new Error('This page was saved in IndexedDB, which is not available now.')
  }
  return attempt(fallback)
}

export const loadDemoPage = (documentId: string): Promise<LoadedPage> =>
  loadPage(documentId, { primary: indexedDbStore, fallback: localStore, session: demoSession })
