import type { BlobStore } from './blobStore'
import type { JsonObject } from '../json'

/** Ids of stored files a document refers to through a `blob:<id>` attribute (any node, any depth). */
export function referencedBlobIds(doc: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(doc)) {
    for (const item of doc) referencedBlobIds(item, into)
  } else if (typeof doc === 'object' && doc !== null) {
    for (const [key, value] of Object.entries(doc)) {
      if (key === 'blob' && typeof value === 'string' && value.startsWith('blob:')) into.add(value.slice(5))
      else referencedBlobIds(value, into)
    }
  }
  return into
}

/**
 * Files stored for a page that none of the given documents refer to. Pass every document that can still show a
 * file: the current body AND every saved version, or restoring a version would find its file gone. Nothing is
 * removed here; `removeBlobs` does that on purpose.
 */
export async function findOrphanBlobs(
  blobs: BlobStore,
  pageId: string,
  documents: readonly (JsonObject | unknown)[],
): Promise<readonly string[]> {
  const used = new Set<string>()
  for (const doc of documents) referencedBlobIds(doc, used)
  return (await blobs.list(pageId)).map((b) => b.id).filter((id) => !used.has(id))
}

/** Removes the given files and reports how many were removed; a failure stops there and is thrown. */
export async function removeBlobs(blobs: BlobStore, ids: readonly string[]): Promise<number> {
  let removed = 0
  for (const id of ids) {
    await blobs.remove(id)
    removed += 1
  }
  return removed
}
