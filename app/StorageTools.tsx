import { useState } from 'react'
import { demoBlobs, demoPages, demoRegistry } from './demoSession'
import { countInlineFiles, migratePageFiles, scanOrphans, sweepOrphans } from './storageTools'
import { askOtherTabs, refuseIfOtherTabsDirty } from './tabCoordination'
import './storageTools.css'

interface Row {
  readonly id: string
  readonly title: string
  readonly inline: number | null
  readonly unused: number | null
  readonly recent: number
  readonly problem: string | null
}

async function livePages(parentId: string | null, depth = 0): Promise<{ id: string; title: string }[]> {
  if (depth > 12) return []
  const out: { id: string; title: string }[] = []
  for (const record of await demoRegistry.children(parentId)) {
    out.push({ id: record.id, title: record.title })
    out.push(...(await livePages(record.id, depth + 1)))
  }
  return out
}

/**
 * Explicit tools for moving old inline files into the file store and removing files nothing refers to.
 * Both only touch pages other than the open one: the open editor would save over a change made behind it.
 * Nothing runs by itself, and each action says what it did or why it did not.
 */
export function StorageTools({ currentId }: { readonly currentId: string }) {
  const [rows, setRows] = useState<readonly Row[] | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const check = async () => {
    setBusy(true)
    setNote(null)
    try {
      const pages = (await livePages(null)).filter((p) => p.id !== currentId)
      const next: Row[] = []
      for (const page of pages) {
        let inline: number | null = null
        let problem: string | null = null
        try {
          const stored = await demoPages.get(page.id)
          inline = stored ? countInlineFiles(stored.doc) : 0
        } catch {
          problem = 'Could not be read.'
        }
        const orphans = await scanOrphans(page.id, { pages: demoPages, blobs: demoBlobs })
        next.push({
          id: page.id,
          title: page.title || 'Untitled',
          inline,
          unused: orphans.ok ? orphans.ids.length : null,
          recent: orphans.ok ? orphans.recent : 0,
          problem: problem ?? (orphans.ok ? null : orphans.message),
        })
      }
      setRows(next)
    } catch {
      setNote('The page list could not be read.')
    }
    setBusy(false)
  }

  const migrate = async (row: Row) => {
    setBusy(true)
    const result = await migratePageFiles(row.id, { pages: demoPages, blobs: demoBlobs })
    setNote(
      !result.ok
        ? result.message
        : result.migrated === 0
          ? 'Nothing to move.'
          : `Moved ${String(result.migrated)} file(s) into storage.` +
            (result.kept.length > 0
              ? ` ${String(result.kept.length)} stayed inline (too large, unsupported or unreadable).`
              : '') +
            ' Older saved versions keep their inline copies.',
    )
    setBusy(false)
    await check()
  }

  const sweep = async (row: Row) => {
    if (
      !window.confirm(`Remove ${String(row.unused)} unused file(s) stored for "${row.title}"? This cannot be undone.`)
    )
      return
    setBusy(true)
    const result = await sweepOrphans(row.id, { pages: demoPages, blobs: demoBlobs }, async () =>
      refuseIfOtherTabsDirty(await askOtherTabs()),
    )
    setNote(result.ok ? `Removed ${String(result.removed)} unused file(s).` : result.message)
    setBusy(false)
    await check()
  }

  return (
    <details className="storage-tools">
      <summary>Storage</summary>
      <p className="storage-tools__hint">
        Works on pages other than the open one. Unused files are only removed once they are a day old and no page or
        saved version refers to them, and not while another tab has unsaved changes.
      </p>
      <button type="button" disabled={busy} onClick={() => void check()}>
        Check other pages
      </button>
      {note && (
        <p role="status" className="storage-tools__note">
          {note}
        </p>
      )}
      {rows && rows.length === 0 && <p className="storage-tools__hint">No other pages.</p>}
      <ul>
        {rows?.map((row) => (
          <li key={row.id}>
            <span className="storage-tools__title">{row.title}</span>
            {row.problem && <span className="storage-tools__hint">{row.problem}</span>}
            <span className="storage-tools__hint">
              {row.inline === null ? 'Files: unknown' : `${String(row.inline)} inline file(s)`}
              {row.unused === null ? '' : `, ${String(row.unused)} unused`}
              {row.recent > 0 ? `, ${String(row.recent)} unused but newer than a day (kept)` : ''}
            </span>
            <span className="storage-tools__actions">
              {(row.inline ?? 0) > 0 && (
                <button type="button" disabled={busy} onClick={() => void migrate(row)}>
                  Move files to storage
                </button>
              )}
              {(row.unused ?? 0) > 0 && (
                <button type="button" disabled={busy} onClick={() => void sweep(row)}>
                  Remove unused files
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
