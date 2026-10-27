import type { Editor, JSONContent } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Extension } from '@tiptap/core'
import { useState } from 'react'
import type { PagePlugin } from '../../editor/core'

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

declare module '@tiptap/core' {
  interface Storage {
    docPersistence: {
      degraded: boolean
      dirty: boolean
      timer: ReturnType<typeof setTimeout> | null
      flush?: () => void
    }
  }
}

/**
 * Local document persistence for the demo page: the edited document is saved under the stable
 * document id, so a reload keeps the user's edits and comment anchors. Explicit reset restores
 * the sample document (comments keep their content and show as orphaned; the version history
 * stays). Save failures are disclosed in the reset popover instead of failing silently.
 */
const docPersistenceExtension = Extension.create({
  name: 'docPersistence',

  addStorage() {
    return {
      degraded: false,
      flush: undefined as (() => void) | undefined,
    }
  },

  onBeforeCreate() {
    // No browser (server rendering, schema-only editors): nothing to persist to.
    if (typeof window === 'undefined') return
    const { editor } = this
    const storage = editor.storage.docPersistence
    let pending: ProseMirrorNode | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    // Serializes the latest edited document. Holding the node (not reading the editor) keeps this safe
    // to call while the editor is being destroyed.
    const flush = () => {
      if (timer) clearTimeout(timer)
      timer = null
      if (!pending) return
      const documentId = editor.storage.documentIdentity?.documentId ?? 'default'
      try {
        localStorage.setItem(keyFor(documentId), JSON.stringify(pending.toJSON()))
        storage.degraded = false
        pending = null
      } catch {
        storage.degraded = true
      }
    }
    storage.flush = flush

    const onUpdate = () => {
      pending = editor.state.doc
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, SAVE_DEBOUNCE_MS)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    editor.on('update', onUpdate)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    editor.on('destroy', () => {
      flush()
      editor.off('update', onUpdate)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    })
  },
})

function ResetPopover({ editor }: { readonly editor: Editor }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="page-reset">
      <p>
        Your edits are saved locally in this browser. Resetting reloads the sample document; comments lose their anchors
        (content is kept) and the version history stays.
      </p>
      {confirming ? (
        <button
          type="button"
          className="is-danger"
          onClick={() => {
            resetPersistedDoc(editor.storage.documentIdentity?.documentId ?? 'default')
            window.location.reload()
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

export const persistencePlugin: PagePlugin = {
  id: 'persistence',
  extensions: [docPersistenceExtension],
  toolbarItems: [
    {
      id: 'persistence:reset',
      group: 'document',
      label: 'Reset document',
      title: 'Document storage',
      icon: 'history',
      placement: 'main',
      isEnabled: () => true,
      popover: ({ editor }) => <ResetPopover editor={editor} />,
    },
  ],
}
