import { useEffect, useState } from 'react'
import type { PageSettings, PageSettingsStore } from '../src/editor/core'
import { AiDialog } from './AiDialog'

/** Review preference is per page. Lock is shown here but managed by the existing controller. */
export function PageSettingsModal({
  pageId,
  settings,
  close,
}: {
  readonly pageId: string
  readonly settings: PageSettingsStore
  readonly close: () => void
}) {
  const [value, setValue] = useState<PageSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void settings.get(pageId).then(
      (next) => {
        if (active) {
          setValue(next)
          setError('')
        }
      },
      () => {
        if (active) setError('Could not read page settings. Nothing was changed.')
      },
    )
    return () => {
      active = false
    }
  }, [settings, pageId, attempt])
  const save = async () => {
    if (!value) return
    setBusy(true)
    setError('')
    try {
      await settings.set(pageId, { aiReview: value.aiReview })
      close()
    } catch {
      setError('Could not save page settings. Try again.')
      setBusy(false)
    }
  }
  return (
    <AiDialog title="Page settings" close={close} busy={busy}>
      {error && <p role="alert">{error}</p>}
      {!value ? (
        <>
          <p role="status">{error ? 'Settings unavailable.' : 'Loading settings…'}</p>
          {error && (
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </button>
          )}
        </>
      ) : (
        <>
          <p className="ai-muted">These settings apply only to this page, on this browser.</p>
          <label className="ai-check">
            <input
              type="checkbox"
              checked={value.aiReview === 'ask'}
              onChange={(event) => setValue({ ...value, aiReview: event.target.checked ? 'ask' : 'apply' })}
            />
            Review AI changes before applying
          </label>
          <p className="ai-muted">
            When off, proposed edits apply directly. Lock, validation and conflict checks still run. Turn this on to
            undo "Never ask me again".
          </p>
          <p>Page lock: {value.locked ? 'Locked' : 'Unlocked'}. Use the lock control in the toolbar to change it.</p>
          <footer className="ai-dialog__actions">
            <button type="button" disabled={busy} onClick={close}>
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save settings'}
            </button>
          </footer>
        </>
      )}
    </AiDialog>
  )
}
