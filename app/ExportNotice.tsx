import { useSyncExternalStore } from 'react'
import { dismissExportNotice, getExportNotice, subscribeExportNotice } from './exportOmitted'
import { inStack } from './SaveStatus'

/** After an export that left files out: says how many and why. The exported file carries its own note too. */
export function ExportNotice({ host }: { readonly host: HTMLElement | null }) {
  const omitted = useSyncExternalStore(subscribeExportNotice, getExportNotice)
  if (omitted.length === 0) return null
  const failed = omitted.some((o) => o.ref === '')
  const reasons = [...new Set(omitted.map((o) => o.reason))].join(' ')
  return inStack(
    host,
    <div className="save-status is-notice" role="status">
      <span>
        {failed
          ? 'Stored files could not be prepared, so this export may be missing images or files. Check it before you rely on it.'
          : `${omitted.length === 1 ? '1 file was' : `${String(omitted.length)} files were`} not included in the export. ${reasons}`}
      </span>
      <button type="button" onClick={dismissExportNotice}>
        Dismiss
      </button>
    </div>,
  )
}
