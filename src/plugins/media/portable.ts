import { isSafeMediaSource, type BlobStore, type MediaSourceKind } from '../../editor/core'
import type { Doc, DocNode } from '../export/types'
import { MAX_EMBED_BYTES } from './files'
import { isBlobRef } from './host'

export interface OmittedFile {
  /** The `blob:<id>` reference that was left out. */
  readonly ref: string
  readonly reason: string
}

export interface InlineOptions {
  /** Largest file turned into a data URL, in bytes. Default 8 MB, the same cap as inline uploads. */
  readonly maxInlineBytes?: number
}

const KINDS: readonly string[] = ['image', 'video', 'audio', 'file']

const toDataUrl = (blob: Blob, type: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.onload = () => {
      const text = String(reader.result)
      // FileReader reports the blob's own type; pin the stored type so the safety check sees what was stored.
      resolve(text.replace(/^data:[^;,]*/, `data:${type}`))
    }
    reader.readAsDataURL(blob)
  })

/**
 * Prepares a document for the synchronous exporters: each stored-file reference becomes a data URL when the
 * file is readable, of a type allowed for that block kind and within the size cap. Anything else keeps its
 * reference (so the exporter writes its explicit "not included" note) and is listed in `omitted` with a
 * reason. The input document is never changed.
 */
export async function inlineStoredFiles(
  doc: Doc,
  blobs: BlobStore | undefined,
  options: InlineOptions = {},
): Promise<{ doc: Doc; omitted: OmittedFile[] }> {
  const cap = options.maxInlineBytes ?? MAX_EMBED_BYTES
  const omitted: OmittedFile[] = []
  const seen = new Map<string, Promise<{ type: string; blob: Blob } | string>>()

  const load = (ref: string) => {
    let pending = seen.get(ref)
    if (!pending) {
      pending = (async () => {
        if (!blobs) return 'No file store is available.'
        try {
          const stored = await blobs.get(ref.slice('blob:'.length))
          if (!stored) return 'The file is missing from the store.'
          return { type: stored.type, blob: stored.blob }
        } catch {
          return 'The file could not be read.'
        }
      })()
      seen.set(ref, pending)
    }
    return pending
  }
  const omit = (ref: string, reason: string) => {
    if (!omitted.some((entry) => entry.ref === ref)) omitted.push({ ref, reason })
  }

  const walk = async (node: DocNode): Promise<DocNode> => {
    let next = node
    const ref = node.attrs?.blob
    if (node.type === 'media' && isBlobRef(ref) && !node.attrs?.src) {
      const kind = String(node.attrs?.kind ?? '')
      const loaded = await load(ref)
      if (typeof loaded === 'string') omit(ref, loaded)
      else if (!KINDS.includes(kind)) omit(ref, 'This kind of block cannot carry an inline file.')
      else if (loaded.blob.size > cap)
        omit(ref, `The file is larger than the ${Math.round(cap / 1024 / 1024)} MB inline limit.`)
      else {
        try {
          const url = await toDataUrl(loaded.blob, loaded.type)
          if (isSafeMediaSource(kind as MediaSourceKind, url))
            next = { ...node, attrs: { ...node.attrs, src: url, blob: '' } }
          else omit(ref, 'The file type is not allowed in an export.')
        } catch {
          omit(ref, 'The file could not be read.')
        }
      }
    }
    if (node.content) {
      const content: DocNode[] = []
      for (const child of node.content) content.push(await walk(child))
      next = { ...next, content }
    }
    return next
  }

  const content: DocNode[] = []
  for (const node of doc.content ?? []) content.push(await walk(node))
  return { doc: { ...doc, content }, omitted }
}
