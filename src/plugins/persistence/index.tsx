import type { Editor, JSONContent } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Extension } from '@tiptap/core'
import { useState } from 'react'
import {
  createLocalStorageStore,
  StaleRevisionError,
  StorageQuotaError,
  UnsupportedFormatError,
  type JsonObject,
  type PagePlugin,
  type PageStore,
} from '../../editor/core'

const SAVE_DEBOUNCE_MS = 500

const keyFor = (documentId: string): string => `page:doc:${documentId}`

/**
 * Loads the locally persisted document, or null when absent/unreadable. The editor schema
 * validates the shape on parse; anything that is not a doc object falls back to the sample.
 */
export const loadPersistedDoc = (documentId: string): JSONContent | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(documentId)) ?? 'null') as unknown
    if (typeof raw === 'object' && raw !== null && (raw as JSONContent).type === 'doc') return raw as JSONContent
    return null
  } catch {
    return null
  }
}

/** Removes the persisted copy of one document only; other documents' saves are preserved. */
export const resetPersistedDoc = (documentId: string): void => {
  localStorage.removeItem(keyFor(documentId))
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

/** What the editor needs to know about where it saves. Mutable: the host sets `revision` after loading. */
export interface PersistenceSession {
  store: PageStore
  /** Revision of the loaded page, `null` when the page did not exist, `undefined` when unknown (no check). */
  revision: number | null | undefined
  /** Saves in flight from this tab (editors sharing the session, e.g. a remounted one). Set by the persistence extension. */
  writing?: number
}

export interface DocPersistenceStorage {
  status: SaveStatus
  /** Message for `error` and `conflict`. */
  message: string
  /** Kept for callers that only need to know whether the last save failed. */
  degraded: boolean
  flush?: () => void
  /** Stops the close-tab prompt, for when the user has explicitly chosen to discard unsaved edits. */
  allowUnload?: () => void
  retry?: () => void
  subscribe: (listener: () => void) => () => void
}

declare module '@tiptap/core' {
  interface Storage {
    docPersistence: DocPersistenceStorage
  }
}

const SAVE_FAILED = 'Could not save this page. Your latest edits are only in this tab.'

/**
 * Document persistence: the edited document is saved to the page store under the stable document id,
 * so a reload keeps the user's edits and comment anchors. Saves are serialized, carry the revision
 * they were loaded at, and never overwrite a newer copy: a stale write stops saving and reports a
 * conflict. Failures are reported through `storage.docPersistence.status`, not swallowed.
 */
/** One session for the whole app, or a function that gives each document its own (needed once pages can be switched). */
export type SessionSource = PersistenceSession | ((documentId: string) => PersistenceSession)
const sessionFor = (source: SessionSource, documentId: string): PersistenceSession =>
  typeof source === 'function' ? source(documentId) : source
const docIdOf = (editor: Editor): string => editor.storage.documentIdentity?.documentId ?? 'default'

const createDocPersistenceExtension = (source: SessionSource) =>
  Extension.create({
    name: 'docPersistence',

    addStorage(): DocPersistenceStorage {
      const listeners = new Set<() => void>()
      return {
        status: 'idle',
        message: '',
        degraded: false,
        flush: undefined,
        allowUnload: undefined,
        retry: undefined,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        // Internal: notified by set() below.
        ...({ listeners } as object),
      }
    },

    onBeforeCreate() {
      // No browser (server rendering, schema-only editors): nothing to persist to.
      if (typeof window === 'undefined') return
      const { editor } = this
      const session = sessionFor(source, docIdOf(editor))
      const storage = editor.storage.docPersistence
      const listeners = (storage as unknown as { listeners: Set<() => void> }).listeners
      const set = (status: SaveStatus, message = '') => {
        storage.status = status
        storage.message = message
        storage.degraded = status === 'error'
        listeners.forEach((listener) => listener())
      }
      let pending: ProseMirrorNode | null = null
      let timer: ReturnType<typeof setTimeout> | null = null
      let inFlight = false
      let stopped = false

      // Holding the node (not reading the editor) keeps this safe to call while the editor is destroyed.
      const flush = () => {
        if (timer) clearTimeout(timer)
        timer = null
        if (!pending || inFlight || stopped) return
        const doc = pending
        pending = null
        inFlight = true
        session.writing = (session.writing ?? 0) + 1
        const documentId = editor.storage.documentIdentity?.documentId ?? 'default'
        set('saving')
        const options = session.revision === undefined ? undefined : { expectedRevision: session.revision }
        session.store
          .put(documentId, doc.toJSON() as JsonObject, options)
          .then((saved) => {
            session.writing = Math.max(0, (session.writing ?? 1) - 1)
            if (session.revision !== undefined) session.revision = saved.revision
            inFlight = false
            if (pending) flush()
            else set('saved')
          })
          .catch((error: unknown) => {
            if (inFlight) session.writing = Math.max(0, (session.writing ?? 1) - 1)
            inFlight = false
            if (error instanceof StaleRevisionError) {
              stopped = true
              pending = null
              set(
                'conflict',
                'This page changed somewhere else (another tab?). Download your version before reloading: edits made here since then are not saved.',
              )
              return
            }
            if (error instanceof UnsupportedFormatError) {
              stopped = true
              pending = null
              set(
                'conflict',
                'This page was saved by a newer version of the editor, so it was not changed. Download your version to keep what is on screen.',
              )
              return
            }
            if (error instanceof StorageQuotaError) {
              pending ??= doc
              set(
                'error',
                'The browser has no room left to save this page. Your last saved copy is kept. Free some space or download your version, then try again.',
              )
              return
            }
            // Keep the unsaved document so a retry or the next edit writes the latest.
            pending ??= doc
            set('error', SAVE_FAILED)
          })
      }
      storage.flush = flush
      storage.retry = () => {
        if (stopped) return
        pending ??= editor.state.doc
        flush()
      }

      // True while another tab's copy is being put into the editor: that is not an edit made here.
      let showingRemote = false
      const onUpdate = () => {
        if (stopped || showingRemote) return
        pending = editor.state.doc
        if (timer) clearTimeout(timer)
        timer = setTimeout(flush, SAVE_DEBOUNCE_MS)
      }
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') flush()
      }
      // Closing the tab with unsaved changes asks first (the browser shows its own generic prompt).
      let unloadAllowed = false
      storage.allowUnload = () => {
        unloadAllowed = true
      }
      const onBeforeUnload = (event: BeforeUnloadEvent) => {
        if (!unloadAllowed && (storage.status === 'error' || storage.status === 'conflict')) event.preventDefault()
      }
      window.addEventListener('beforeunload', onBeforeUnload)
      // Another tab saved or removed this page. With nothing unsaved here the new copy is shown; with unsaved
      // edits here nothing is replaced and the conflict is reported now, not at the next failed save.
      let applying = false
      const idNow = () => editor.storage.documentIdentity?.documentId ?? 'default'
      const unsubscribe = session.store.subscribe?.((change) => {
        if (change.id !== idNow() || stopped || inFlight || applying || (session.writing ?? 0) > 0) return
        if (change.revision !== null && session.revision !== undefined && change.revision <= (session.revision ?? 0))
          return
        if (change.revision === null || pending || timer) {
          stopped = true
          pending = null
          if (timer) clearTimeout(timer)
          timer = null
          set(
            'conflict',
            change.revision === null
              ? 'This page was removed in another tab. Download your version to keep what is on screen.'
              : 'This page changed in another tab while you had unsaved edits here. Download your version before reloading: edits made here since then are not saved.',
          )
          return
        }
        applying = true
        void session.store
          .get(idNow())
          .then((latest) => {
            if (!latest || stopped || pending || timer || editor.isDestroyed) return
            if (session.revision !== undefined && latest.revision <= (session.revision ?? 0)) return
            showingRemote = true
            try {
              editor.commands.setContent(latest.doc as JSONContent, { emitUpdate: false })
            } finally {
              showingRemote = false
            }
            session.revision = latest.revision
            set('saved', 'Updated from another tab')
          })
          .catch(() => {
            set('error', 'Another tab saved this page, but its copy could not be read here. Reload to see it.')
          })
          .finally(() => {
            applying = false
          })
      })
      editor.on('update', onUpdate)
      window.addEventListener('pagehide', flush)
      document.addEventListener('visibilitychange', onVisibility)
      editor.on('destroy', () => {
        flush()
        unsubscribe?.()
        editor.off('update', onUpdate)
        window.removeEventListener('pagehide', flush)
        window.removeEventListener('beforeunload', onBeforeUnload)
        document.removeEventListener('visibilitychange', onVisibility)
      })
    },
  })

function ResetPopover({ editor, session }: { readonly editor: Editor; readonly session: PersistenceSession }) {
  const [confirming, setConfirming] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <div className="page-reset">
      <p>
        Your edits are saved locally in this browser. Resetting reloads the sample document; comments lose their anchors
        (content is kept) and the version history stays.
      </p>
      {failed && <p role="alert">Could not reset the saved page. Nothing was changed.</p>}
      {confirming ? (
        <button
          type="button"
          className="is-danger"
          onClick={() => {
            editor.storage.docPersistence.allowUnload?.() // this tab's own removal is not a conflict
            void session.store
              .remove(editor.storage.documentIdentity?.documentId ?? 'default')
              .then(() => window.location.reload())
              .catch(() => setFailed(true))
          }}
        >
          Confirm reset
        </button>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}>
          Reset document
        </button>
      )}
    </div>
  )
}

export const createPersistencePlugin = (source: SessionSource): PagePlugin => ({
  id: 'persistence',
  extensions: [createDocPersistenceExtension(source)],
  toolbarItems: [
    {
      id: 'persistence:reset',
      group: 'document',
      label: 'Reset document',
      title: 'Document storage',
      icon: 'history',
      placement: 'main',
      isEnabled: () => true,
      popover: ({ editor }) => <ResetPopover editor={editor} session={sessionFor(source, docIdOf(editor))} />,
    },
  ],
})

/** Default: the original localStorage format, no revision check (the first write is unconditional). */
export const persistencePlugin: PagePlugin = createPersistencePlugin({
  store: createLocalStorageStore(),
  revision: undefined,
})
