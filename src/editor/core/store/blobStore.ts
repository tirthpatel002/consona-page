/** One stored file. The page holds only `id`; the bytes live here. */
export interface StoredBlob {
  readonly id: string
  readonly pageId: string
  readonly blob: Blob
  readonly type: string
  readonly size: number
  readonly createdAt: number
}

export type BlobSummary = Pick<StoredBlob, 'id' | 'pageId' | 'type' | 'size' | 'createdAt'>

export type BlobErrorCode = 'too_large' | 'page_limit' | 'type_not_allowed'

/** A refused file. Nothing was stored. */
export class BlobLimitError extends Error {
  readonly code: BlobErrorCode
  readonly limit: number
  constructor(code: BlobErrorCode, message: string, limit: number) {
    super(message)
    this.name = 'BlobLimitError'
    this.code = code
    this.limit = limit
  }
}

export interface BlobLimits {
  /** Largest single file, in bytes. Default 25 MiB. */
  readonly maxFileBytes: number
  /** Total bytes allowed per page. Default 250 MiB. */
  readonly maxPageBytes: number
  /** Allowed MIME types (exact match or `prefix/*`). The file kind's own check still applies. */
  readonly allowedTypes: readonly string[]
}

export const DEFAULT_BLOB_LIMITS: BlobLimits = {
  maxFileBytes: 25 * 1024 * 1024,
  maxPageBytes: 250 * 1024 * 1024,
  allowedTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
}

/**
 * Binary files beside the page store, addressed by id. Adapters check the limits before writing and reject
 * with `BlobLimitError` (limits) or `StorageQuotaError` (browser full); a rejected `put` stores nothing.
 */
export interface BlobStore {
  readonly limits: BlobLimits
  /** Stores a file for a page and returns its summary (with a new id unless `id` is given). */
  put(pageId: string, blob: Blob, options?: { readonly id?: string }): Promise<BlobSummary>
  get(id: string): Promise<StoredBlob | null>
  remove(id: string): Promise<void>
  /** Removes every file of a page (used by delete-forever). */
  removePage(pageId: string): Promise<void>
  list(pageId: string): Promise<readonly BlobSummary[]>
  /** Bytes stored for the page. */
  usage(pageId: string): Promise<number>
}

const typeAllowed = (type: string, allowed: readonly string[]) =>
  allowed.some((rule) => (rule.endsWith('/*') ? type.startsWith(rule.slice(0, -1)) : type === rule))

/** Shared pre-write check used by every adapter. `existing` is the page's current usage excluding a replaced id. */
export function checkBlobLimits(limits: BlobLimits, blob: Blob, existing: number): void {
  if (!typeAllowed(blob.type, limits.allowedTypes)) {
    throw new BlobLimitError('type_not_allowed', `Files of type "${blob.type || 'unknown'}" are not accepted.`, 0)
  }
  if (blob.size > limits.maxFileBytes) {
    throw new BlobLimitError('too_large', 'This file is larger than the per-file limit.', limits.maxFileBytes)
  }
  if (existing + blob.size > limits.maxPageBytes) {
    throw new BlobLimitError('page_limit', 'This page has reached its total file limit.', limits.maxPageBytes)
  }
}

const newBlobId = (): string => 'f' + crypto.randomUUID().replace(/-/g, '').slice(0, 14)

export interface BlobStoreOptions {
  readonly limits?: Partial<BlobLimits>
  readonly now?: () => number
}

const summary = ({ id, pageId, type, size, createdAt }: StoredBlob): BlobSummary => ({
  id,
  pageId,
  type,
  size,
  createdAt,
})

/** In-memory adapter for tests and hosts that store files elsewhere. */
export function createMemoryBlobStore(options: BlobStoreOptions = {}): BlobStore {
  const limits = { ...DEFAULT_BLOB_LIMITS, ...options.limits }
  const now = options.now ?? Date.now
  const all = new Map<string, StoredBlob>()
  const used = (pageId: string, except?: string) =>
    [...all.values()].filter((b) => b.pageId === pageId && b.id !== except).reduce((sum, b) => sum + b.size, 0)
  return {
    limits,
    put(pageId, blob, putOptions) {
      try {
        const id = putOptions?.id ?? newBlobId()
        checkBlobLimits(limits, blob, used(pageId, id))
        const stored: StoredBlob = { id, pageId, blob, type: blob.type, size: blob.size, createdAt: now() }
        all.set(id, stored)
        return Promise.resolve(summary(stored))
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)))
      }
    },
    get: (id) => Promise.resolve(all.get(id) ?? null),
    remove: (id) => {
      all.delete(id)
      return Promise.resolve()
    },
    removePage: (pageId) => {
      for (const [id, b] of all) if (b.pageId === pageId) all.delete(id)
      return Promise.resolve()
    },
    list: (pageId) => Promise.resolve([...all.values()].filter((b) => b.pageId === pageId).map(summary)),
    usage: (pageId) => Promise.resolve(used(pageId)),
  }
}
