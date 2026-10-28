import {
  getSidecarStorage,
  referencedBlobIds,
  removeBlobs,
  StaleRevisionError,
  type BlobStore,
  type PageStore,
} from '../src/editor/core'
import { migrateInlineMedia, type MigrationKept } from '../src/plugins/media'

/** Count of media blocks that still hold their file inline as a data URL (not yet in the file store). */
export function countInlineFiles(doc: unknown): number {
  if (Array.isArray(doc)) return doc.reduce<number>((sum, item) => sum + countInlineFiles(item), 0)
  if (typeof doc !== 'object' || doc === null) return 0
  const node = doc as { type?: string; attrs?: { src?: unknown; blob?: unknown }; content?: unknown }
  const own =
    node.type === 'media' &&
    !node.attrs?.blob &&
    typeof node.attrs?.src === 'string' &&
    /^data:/i.test(node.attrs.src.trim())
      ? 1
      : 0
  return own + countInlineFiles(node.content)
}

export type ToolFailure = { readonly ok: false; readonly message: string }

export interface MigrateOutcome {
  readonly ok: true
  readonly migrated: number
  readonly kept: readonly MigrationKept[]
  /** True when the page body was rewritten. False when there was nothing to move. */
  readonly saved: boolean
}

/**
 * Moves a closed page's inline files into the file store and saves the page once, only if the stored
 * revision is still the one that was read. If the save fails or loses a race, the files just added are
 * removed again and the page is unchanged. History keeps its inline copies. Never run on the open page:
 * the open editor would later save over it.
 */
export async function migratePageFiles(
  pageId: string,
  deps: { readonly pages: PageStore; readonly blobs: BlobStore },
): Promise<MigrateOutcome | ToolFailure> {
  let stored
  try {
    stored = await deps.pages.get(pageId)
  } catch {
    return { ok: false, message: 'The page could not be read, so nothing was changed.' }
  }
  if (!stored) return { ok: false, message: 'The page has no saved body.' }
  const result = await migrateInlineMedia(stored.doc, deps.blobs, pageId)
  if (result.migrated === 0) return { ok: true, migrated: 0, kept: result.kept, saved: false }
  try {
    await deps.pages.put(pageId, result.doc, { expectedRevision: stored.revision })
  } catch (error) {
    // The page did not change, so the files just stored have no reader.
    const added = [...referencedBlobIds(result.doc)].filter((id) => !referencedBlobIds(stored.doc).has(id))
    await removeBlobs(deps.blobs, added).catch(() => undefined)
    return {
      ok: false,
      message:
        error instanceof StaleRevisionError
          ? 'The page was saved somewhere else while the files were moved. Nothing was changed. Try again.'
          : 'The page could not be saved, so nothing was changed.',
    }
  }
  return { ok: true, migrated: result.migrated, kept: result.kept, saved: true }
}

/** Every saved version document of a page, read from the history storage. Null when history cannot be read safely. */
export function readVersionDocs(pageId: string): readonly unknown[] | null {
  let raw: string | null
  try {
    raw = getSidecarStorage().getItem(`page:versions:${pageId}`)
  } catch {
    return null
  }
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    const entries = Array.isArray(parsed) ? parsed : (parsed as { entries?: unknown }).entries
    if (!Array.isArray(entries)) return null
    return entries.map((entry) => (entry as { doc?: unknown }).doc)
  } catch {
    return null
  }
}

/** Files younger than this are never removed: an upload may be on its way into a page that has not saved yet. */
export const SWEEP_GRACE_MS = 24 * 60 * 60 * 1000

export interface OrphanReport {
  readonly ok: true
  /** Unused files old enough to remove. */
  readonly ids: readonly string[]
  /** Unused files kept because they are newer than the grace period. */
  readonly recent: number
}

/**
 * Stored files of a page that no page refers to. A file counts as used if ANY page's body or any saved
 * version of any page (trashed pages included) refers to it, because a block copied from this page into
 * another one reads its file from here until the copy is made. If any body or history cannot be read
 * nothing is reported: an unreadable record might refer to every file. Files younger than the grace period
 * are kept.
 */
export async function scanOrphans(
  pageId: string,
  deps: { readonly pages: PageStore; readonly blobs: BlobStore; readonly now?: () => number },
): Promise<OrphanReport | ToolFailure> {
  const used = new Set<string>()
  try {
    for (const summary of await deps.pages.list()) {
      const stored = await deps.pages.get(summary.id)
      if (stored) referencedBlobIds(stored.doc, used)
      const versions = readVersionDocs(summary.id)
      if (versions === null) {
        return { ok: false, message: 'Version history could not be read, so unused files were not checked.' }
      }
      for (const doc of versions) referencedBlobIds(doc, used)
    }
  } catch {
    return { ok: false, message: 'A page could not be read, so unused files were not checked.' }
  }
  const now = (deps.now ?? Date.now)()
  try {
    const unused = (await deps.blobs.list(pageId)).filter((b) => !used.has(b.id))
    const old = unused.filter((b) => now - b.createdAt >= SWEEP_GRACE_MS)
    return { ok: true, ids: old.map((b) => b.id), recent: unused.length - old.length }
  } catch {
    return { ok: false, message: 'The stored files could not be listed.' }
  }
}

/**
 * Removes the unused, old-enough files of a page. `guard` runs first and returns a reason to refuse (for
 * example another tab has unsaved changes). It scans again right before removing.
 */
export async function sweepOrphans(
  pageId: string,
  deps: { readonly pages: PageStore; readonly blobs: BlobStore; readonly now?: () => number },
  guard?: () => Promise<string | null>,
): Promise<{ readonly ok: true; readonly removed: number } | ToolFailure> {
  const refused = guard ? await guard() : null
  if (refused) return { ok: false, message: refused }
  const scan = await scanOrphans(pageId, deps)
  if (!scan.ok) return scan
  try {
    return { ok: true, removed: await removeBlobs(deps.blobs, scan.ids) }
  } catch {
    return { ok: false, message: 'Some unused files could not be removed. Run the check again.' }
  }
}
