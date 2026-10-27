import { useEffect, useState } from 'react'
import type { BlobStore } from '../../editor/core'

/**
 * What the host app gives the media plugin: an optional file store and the id of the page being edited.
 * Without a store, uploads stay inline in the document (data URLs, capped at 8 MB).
 */
export interface MediaHost {
  readonly blobs?: BlobStore
  readonly pageId?: () => string
}

let host: MediaHost = {}
export const setMediaHost = (next: MediaHost): void => {
  host = next
}
export const mediaHost = (): MediaHost => host

const BLOB_REF = /^blob:[A-Za-z0-9_-]{4,64}$/
/** A stored-file reference: `blob:` plus the store id. It is never a link target and never a source. */
export const isBlobRef = (value: unknown): value is string => typeof value === 'string' && BLOB_REF.test(value)
export const blobRefFor = (id: string): string => `blob:${id}`
const idOf = (ref: string): string => ref.slice('blob:'.length)

interface Entry {
  users: number
  readonly url: Promise<string | null>
  resolved: string | null
}
const entries = new Map<string, Entry>()

/** An object URL for a stored file, shared between users and revoked when the last one lets go. */
export function acquireBlobUrl(ref: string): Promise<string | null> {
  const existing = entries.get(ref)
  if (existing) {
    existing.users += 1
    return existing.url
  }
  const store = host.blobs
  const entry: Entry = {
    users: 1,
    resolved: null,
    url: store
      ? store
          .get(idOf(ref))
          .then((stored) => {
            if (!stored) return null
            entry.resolved = URL.createObjectURL(stored.blob)
            return entry.resolved
          })
          .catch(() => null)
      : Promise.resolve(null),
  }
  entries.set(ref, entry)
  return entry.url
}

export function releaseBlobUrl(ref: string): void {
  const entry = entries.get(ref)
  if (!entry) return
  entry.users -= 1
  if (entry.users > 0) return
  entries.delete(ref)
  void entry.url.then((url) => {
    if (url) URL.revokeObjectURL(url)
  })
}

/** The stored bytes of a file (for downloads), or null when the store no longer has it. */
export async function readBlob(ref: string): Promise<Blob | null> {
  const stored = await host.blobs?.get(idOf(ref))
  return stored?.blob ?? null
}

/** The address to show for a media node: its own source, or an object URL for a stored file. */
export function useMediaSrc(src: unknown, blob: unknown): string {
  const [url, setUrl] = useState('')
  const ref = isBlobRef(blob) ? blob : ''
  useEffect(() => {
    if (!ref) return
    let live = true
    void acquireBlobUrl(ref).then((value) => {
      if (live && value) setUrl(value)
    })
    return () => {
      live = false
      releaseBlobUrl(ref)
    }
  }, [ref])
  return ref ? url : String(src ?? '')
}
