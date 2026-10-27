import type { JsonObject } from '../json'

/** One stored page. `id` is stable and unique; there is exactly one body per id. */
export interface StoredPage {
  readonly id: string
  /** The editor document (a Tiptap/ProseMirror doc JSON object). */
  readonly doc: JsonObject
  /** Stored format version (see FORMAT_VERSION). Older records are upgraded when read. */
  readonly format: number
  /** Starts at 1 and grows by 1 on every successful write. */
  readonly revision: number
  /** Milliseconds since the epoch, set by the store on write. */
  readonly updatedAt: number
}

export type PageSummary = Pick<StoredPage, 'id' | 'revision' | 'updatedAt'>

export interface PutOptions {
  /**
   * Optimistic concurrency. A number means "only write if the stored revision is this".
   * `null` means "only write if the page does not exist yet". Omitted means write unconditionally.
   */
  readonly expectedRevision?: number | null
}

/** Thrown by `put` when `expectedRevision` does not match what is stored. Nothing is written. */
export class StaleRevisionError extends Error {
  readonly id: string
  readonly expected: number | null
  readonly actual: number | null
  constructor(id: string, expected: number | null, actual: number | null) {
    super(`Page "${id}" changed: expected revision ${String(expected)}, found ${String(actual)}`)
    this.name = 'StaleRevisionError'
    this.id = id
    this.expected = expected
    this.actual = actual
  }
}

/** A page was written (`revision` is the new revision) or removed (`revision` is null). */
export interface PageChange {
  readonly id: string
  readonly revision: number | null
}

/**
 * Storage adapter for pages, keyed by stable id. Implementations must make `put` atomic with its
 * revision check, and must reject (not swallow) a failed write so callers can show it.
 */
export interface PageStore {
  get(id: string): Promise<StoredPage | null>
  put(id: string, doc: JsonObject, options?: PutOptions): Promise<StoredPage>
  remove(id: string): Promise<void>
  list(): Promise<readonly PageSummary[]>
  /**
   * Optional. Calls `listener` after a successful write or removal, including writes from other tabs when
   * the adapter can see them. Returns an unsubscribe function.
   */
  subscribe?(listener: (change: PageChange) => void): () => void
}
