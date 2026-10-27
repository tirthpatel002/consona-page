import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/core'

const LABELS = { idle: '', saving: 'Saving…', saved: 'Saved on this device' } as const

/** Always-visible save state. Errors and conflicts say what happened and what to do. */
export const inStack = (host: HTMLElement | null, node: ReactNode): ReactNode =>
  host ? createPortal(node, host) : node

export function SaveStatus({
  editor,
  errorHost,
  settingsFailed = false,
}: {
  readonly editor: Editor
  readonly errorHost: HTMLElement | null
  /** The page's lock could not be saved, so a plain "Saved" would overstate what is stored. */
  readonly settingsFailed?: boolean
}) {
  const storage = editor.storage.docPersistence
  const status = useSyncExternalStore(storage.subscribe, () => storage.status)
  const message = useSyncExternalStore(storage.subscribe, () => storage.message)
  if (status === 'idle') return <div className="save-status" role="status" aria-live="polite" />
  if (status === 'error') {
    return inStack(
      errorHost,
      <div className="save-status is-error" role="alert">
        <span>{message}</span>
        <button type="button" onClick={() => storage.retry?.()}>
          Try again
        </button>
      </div>,
    )
  }
  if (status === 'conflict') return inStack(errorHost, <Conflict editor={editor} message={message} />)
  return (
    <div className="save-status" role="status" aria-live="polite">
      {message ||
        (status === 'saved' && settingsFailed ? 'Text saved on this device. Page lock not saved.' : LABELS[status])}
    </div>
  )
}

/** The page changed elsewhere. Reloading would drop what is on screen, so it needs a saved copy or a clear choice. */
function Conflict({ editor, message }: { readonly editor: Editor; readonly message: string }) {
  const [confirming, setConfirming] = useState(false)
  const download = () => {
    const blob = new Blob([JSON.stringify(editor.getJSON(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'my-version.json'
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="save-status is-error" role="alert">
      <span>{message}</span>
      <button type="button" onClick={download}>
        Download my version
      </button>
      {confirming ? (
        <button
          type="button"
          onClick={() => {
            editor.storage.docPersistence.allowUnload?.()
            window.location.reload()
          }}
        >
          Discard my edits and reload
        </button>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}>
          Reload latest…
        </button>
      )}
      {confirming && (
        <button type="button" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      )}
    </div>
  )
}
