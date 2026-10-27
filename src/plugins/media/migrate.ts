import { BlobLimitError, type BlobStore, type JsonObject } from '../../editor/core'
import { blobRefFor } from './host'
import { dataMime, isSafeMediaSrc, asKind } from './sources'

export interface MigrationKept {
  /** Where the block stays inline, as a path of child indexes from the document root. */
  readonly path: readonly number[]
  readonly reason: 'limit' | 'type' | 'unreadable' | 'store_failed'
}

export interface MigrationResult {
  readonly doc: JsonObject
  /** Files moved into the store. */
  readonly migrated: number
  /** Blocks left exactly as they were, with the reason. Nothing is dropped. */
  readonly kept: readonly MigrationKept[]
}

/** Decodes `data:<mime>[;params];base64,<data>` or a percent-encoded data URL. Null when it is not valid. */
function decode(src: string): Blob | null {
  const comma = src.indexOf(',')
  const mime = dataMime(src)
  if (comma < 0 || !mime) return null
  try {
    const body = src.slice(comma + 1)
    if (/;base64$/i.test(src.slice(0, comma))) {
      const bin = atob(body)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
      return new Blob([bytes], { type: mime })
    }
    return new Blob([decodeURIComponent(body)], { type: mime })
  } catch {
    return null
  }
}

/**
 * Moves inline data-URL files of a page's media blocks into the file store (`blob` attribute, empty `src`).
 * Safe to run twice: blocks that already have a stored file, remote links, embeds and bookmarks are untouched.
 * A block whose file is refused or unreadable stays inline and is reported in `kept`; if the store fails
 * part way, earlier blocks stay migrated and the rest stay inline. The input document is not modified.
 * The caller decides when to save the result; nothing here writes the page.
 */
export async function migrateInlineMedia(doc: JsonObject, blobs: BlobStore, pageId: string): Promise<MigrationResult> {
  const copy = structuredClone(doc)
  const kept: MigrationKept[] = []
  let migrated = 0
  const visit = async (node: unknown, path: number[]): Promise<void> => {
    if (typeof node !== 'object' || node === null) return
    const n = node as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }
    if (n.type === 'media' && n.attrs) {
      const kind = asKind(n.attrs.kind)
      const src = n.attrs.src
      if (
        !n.attrs.blob &&
        typeof src === 'string' &&
        /^data:/i.test(src.trim()) &&
        (kind === 'image' || kind === 'video' || kind === 'audio' || kind === 'file') &&
        isSafeMediaSrc(kind, src)
      ) {
        const blob = decode(src.trim())
        if (!blob) kept.push({ path, reason: 'unreadable' })
        else {
          try {
            const stored = await blobs.put(pageId, blob)
            n.attrs.blob = blobRefFor(stored.id)
            n.attrs.src = ''
            migrated += 1
          } catch (error) {
            kept.push({
              path,
              reason:
                error instanceof BlobLimitError
                  ? error.code === 'type_not_allowed'
                    ? 'type'
                    : 'limit'
                  : 'store_failed',
            })
          }
        }
      }
    }
    if (Array.isArray(n.content)) {
      for (const [i, child] of n.content.entries()) await visit(child, [...path, i])
    }
  }
  await visit(copy, [])
  return { doc: copy, migrated, kept }
}
