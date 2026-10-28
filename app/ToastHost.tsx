import { useSyncExternalStore } from 'react'
import { dismissToast, getToast, subscribeToast } from './toast'
import './toast.css'

/** Fixed corner host for soft status (save, sidebar actions). Errors with recovery stay in the bottom stack. */
export function ToastHost() {
  const toast = useSyncExternalStore(subscribeToast, getToast, getToast)
  if (!toast) return null
  return (
    <div className={`app-toast${toast.tone === 'error' ? ' is-error' : ''}`} role={toast.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
      <span>{toast.text}</span>
      {toast.undo && (
        <button
          type="button"
          onClick={() => {
            const undo = toast.undo
            dismissToast(toast.id)
            if (undo) void undo()
          }}
        >
          Undo
        </button>
      )}
      <button type="button" aria-label="Dismiss" onClick={() => dismissToast(toast.id)}>
        Dismiss
      </button>
    </div>
  )
}
