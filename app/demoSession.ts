import type { JSONContent } from '@tiptap/core'
import {
  createIndexedDbBlobStore,
  createIndexedDbSidecar,
  setSidecarStorage,
  createIndexedDbRegistryStorage,
  createMemoryBlobStore,
  createMemoryRegistryStorage,
  createPageRegistry,
  createIndexedDbStore,
  createLocalStorageStore,
  type BlobStore,
  type PageListRegistry,
  type PageStore,
} from '../src/editor/core'
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

const sessions = new Map<string, PersistenceSession>()
/** Each page has its own session, so saving or loading one page never changes another page's revision. */
export const demoSessionFor = (id: string): PersistenceSession => {
  let found = sessions.get(id)
  if (!found) {
    found = { store: indexedDbStore ?? localStore, revision: undefined }
    sessions.set(id, found)
  }
  return found
}
let currentPageId = ''
/** The page the editor shows now; the file store files new uploads under it. */
export const getCurrentPageId = (): string => currentPageId
export const setCurrentPageId = (id: string): void => {
  currentPageId = id
}

/**
 * Files and the page list live next to the page bodies. Without IndexedDB they are kept in memory only, so
 * they last for this tab session and the demo says nothing more about them than that.
 */
export const demoBlobs: BlobStore = indexedDbStore ? createIndexedDbBlobStore() : createMemoryBlobStore()
/** The page store every page body lives in. */
export const demoPages: PageStore = indexedDbStore ?? localStore
export const demoRegistry: PageListRegistry = createPageRegistry({
  storage: indexedDbStore ? createIndexedDbRegistryStorage() : createMemoryRegistryStorage(),
  pages: demoPages,
  blobs: demoBlobs,
})
export const demoFilesPersist = indexedDbStore !== null

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

const sidecar = indexedDbStore ? createIndexedDbSidecar() : null
let sidecarReady: Promise<void> | null = null
/** True after a background write of history or comments failed, so they may not survive a reload. */
export let sidecarWriteFailed = false
const sidecarListeners = new Set<() => void>()
const setSidecarFailed = (value: boolean) => {
  if (sidecarWriteFailed === value) return
  sidecarWriteFailed = value
  sidecarListeners.forEach((l) => l())
}
export const subscribeSidecar = (listener: () => void) => {
  sidecarListeners.add(listener)
  return () => void sidecarListeners.delete(listener)
}
export const getSidecarFailed = () => sidecarWriteFailed
/** Writes history and comments again. Clears the warning only when the write is stored. */
export const retrySidecar = async (): Promise<void> => {
  if (!sidecar) return
  try {
    await sidecar.retry()
    setSidecarFailed(false)
  } catch {
    setSidecarFailed(true)
  }
}
/** History and comments move to IndexedDB before the editor mounts. If that fails they stay in localStorage. */
export const prepareSidecar = (): Promise<void> => {
  if (!sidecar) return Promise.resolve()
  sidecarReady ??= sidecar.ready().then(
    () => {
      sidecar.onWriteError = () => setSidecarFailed(true)
      setSidecarStorage(sidecar)
    },
    () => undefined,
  )
  return sidecarReady
}

export const loadDemoPage = async (documentId: string): Promise<LoadedPage> => {
  await prepareSidecar()
  return loadPage(documentId, { primary: indexedDbStore, fallback: localStore, session: demoSessionFor(documentId) })
}

// The demo has one document and no account/workspace layer, so its identity is a UUID created
// once and persisted locally - stable across reloads and title changes, never reused by a second
// document (a real host app passes its own document/workspace IDs instead).
const DOCUMENT_ID_KEY = 'page:document:id'
export const demoDocumentId = ((): string => {
  try {
    const existing = localStorage.getItem(DOCUMENT_ID_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    localStorage.setItem(DOCUMENT_ID_KEY, created)
    return created
  } catch {
    return 'demo-document'
  }
})()
