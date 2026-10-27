import { useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'

const LABELS = { idle: '', saving: 'Saving…', saved: 'Saved on this device' } as const

/** Always-visible save state. Errors and conflicts say what happened and what to do. */
export function SaveStatus({ editor }: { readonly editor: Editor }) {
  const storage = editor.storage.docPersistence
  const status = useSyncExternalStore(storage.subscribe, () => storage.status)
  const message = useSyncExternalStore(storage.subscribe, () => storage.message)
  if (status === 'idle') return <div className="save-status" role="status" aria-live="polite" />
  if (status === 'error') {
    return (
      <div className="save-status is-error" role="alert">
        <span>{message}</span>
        <button type="button" onClick={() => storage.retry?.()}>
          Try again
        </button>
      </div>
    )
  }
  if (status === 'conflict') {
    return (
      <div className="save-status is-error" role="alert">
        <span>{message}</span>
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
  return (
    <div className="save-status" role="status" aria-live="polite">
      {LABELS[status]}
    </div>
  )
}
