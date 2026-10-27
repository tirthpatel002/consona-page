import type { JsonObject } from '../json'
import type { StoredPage } from './types'

/**
 * Version of the stored page record layout and document conventions. Bump it when a stored page needs a
 * rewrite, and add a step to `MIGRATIONS` for the version before it.
 *
 * 0: records written before versions existed (no `format` field, no block ids required).
 * 1: current.
 */
export const FORMAT_VERSION = 1

/** Thrown when a stored page was written by a newer version than this code understands. It is never opened or overwritten. */
export class UnsupportedFormatError extends Error {
  readonly id: string
  readonly found: number
  constructor(id: string, found: number) {
    super(
      `Page "${id}" was saved by a newer version (format ${String(found)}; this one reads up to ${String(FORMAT_VERSION)}).`,
    )
    this.name = 'UnsupportedFormatError'
    this.id = id
    this.found = found
  }
}

/** Thrown when a write fails because the browser storage is full. The previous saved copy is untouched. */
export class StorageQuotaError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('The browser has no room left to save this page.', options)
    this.name = 'StorageQuotaError'
  }
}

/** Whether `error` is the browser's "storage full" failure (DOMException name differs by browser). */
export function isQuotaError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { name, code } = error as { name?: unknown; code?: unknown }
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014
}

/** Wraps a quota failure in `StorageQuotaError`; any other error passes through unchanged. */
export const asStorageError = (error: unknown): Error =>
  isQuotaError(error)
    ? new StorageQuotaError({ cause: error })
    : error instanceof Error
      ? error
      : new Error(String(error))

type Migration = (page: StoredPage) => StoredPage

/** `MIGRATIONS[n]` upgrades a page from format n to n + 1. Each step must be safe to run on its own output. */
const MIGRATIONS: readonly Migration[] = [(page) => ({ ...page, format: 1 })]

/** Brings a stored record up to the current format. Throws UnsupportedFormatError for a newer one. */
export function migrateStoredPage(record: Omit<StoredPage, 'format'> & { readonly format?: number }): StoredPage {
  let page = { ...record, format: record.format ?? 0 } as StoredPage
  if (!Number.isInteger(page.format) || page.format < 0 || page.format > FORMAT_VERSION) {
    throw new UnsupportedFormatError(record.id, record.format ?? -1)
  }
  while (page.format < FORMAT_VERSION) {
    const step = MIGRATIONS[page.format]
    if (!step) throw new UnsupportedFormatError(record.id, page.format)
    page = step(page)
  }
  return page
}

export type { JsonObject }
