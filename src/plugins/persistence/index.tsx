import type { Editor, JSONContent } from '@tiptap/core'
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
    docPersistence: { degraded: boolean }
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
    return { degraded: false }
  },

  onUpdate() {
    const storage = this.editor.storage.docPersistence
    const documentId = this.editor.storage.documentIdentity?.documentId ?? 'default'
    const key = keyFor(documentId)
    const timer = (storage as { timer?: ReturnType<typeof setTimeout> }).timer
    if (timer) clearTimeout(timer)
    ;(storage as { timer?: ReturnType<typeof setTimeout> }).timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(this.editor.getJSON()))
        storage.degraded = false
      } catch {
        storage.degraded = true
      }
    }, SAVE_DEBOUNCE_MS)
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
