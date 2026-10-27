import {
  findOrphanBlobs,
  getSidecarStorage,
  referencedBlobIds,
  removeBlobs,
  StaleRevisionError,
  type BlobStore,
  type JsonObject,
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

export interface OrphanReport {
  readonly ok: true
  readonly ids: readonly string[]
}

/**
 * Stored files of a closed page that neither its body nor any saved version refers to. If the body or the
 * history cannot be read, nothing is reported: an unreadable record might refer to every file.
 */
export async function scanOrphans(
  pageId: string,
  deps: { readonly pages: PageStore; readonly blobs: BlobStore },
): Promise<OrphanReport | ToolFailure> {
  let stored
  try {
    stored = await deps.pages.get(pageId)
  } catch {
    return { ok: false, message: 'The page could not be read, so unused files were not checked.' }
  }
  if (!stored) return { ok: false, message: 'The page has no saved body.' }
  const versions = readVersionDocs(pageId)
  if (versions === null)
    return { ok: false, message: 'Version history could not be read, so unused files were not checked.' }
  try {
    return { ok: true, ids: await findOrphanBlobs(deps.blobs, pageId, [stored.doc as JsonObject, ...versions]) }
  } catch {
    return { ok: false, message: 'The stored files could not be listed.' }
  }
}

/** Removes the unused files of a closed page. It scans again first and only removes files that are still unused. */
export async function sweepOrphans(
  pageId: string,
  deps: { readonly pages: PageStore; readonly blobs: BlobStore },
): Promise<{ readonly ok: true; readonly removed: number } | ToolFailure> {
  const scan = await scanOrphans(pageId, deps)
  if (!scan.ok) return scan
  try {
    return { ok: true, removed: await removeBlobs(deps.blobs, scan.ids) }
  } catch {
    return { ok: false, message: 'Some unused files could not be removed. Run the check again.' }
  }
}
