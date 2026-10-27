import { useSyncExternalStore } from 'react'
import { inStack } from './SaveStatus'
import { getSidecarFailed, retrySidecar, subscribeSidecar } from './demoSession'

/** Shown only when history or comments could not be stored. They are still in memory for this tab. */
export function SidecarStatus({ errorHost }: { readonly errorHost: HTMLElement | null }) {
  const failed = useSyncExternalStore(subscribeSidecar, getSidecarFailed)
  if (!failed) return null
  return inStack(
    errorHost,
    <div className="save-status is-error" role="alert">
      <span>
        Version history or comments could not be saved on this device. They may be lost if you close this tab.
      </span>
      <button type="button" onClick={() => void retrySidecar()}>
        Try again
      </button>
    </div>,
  )
}
