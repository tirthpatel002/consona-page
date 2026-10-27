import type { BlobStore } from './blobStore'
import type { PageStore } from './types'

/** One page's place in the tree. The body lives in the PageStore under the same id, nowhere else. */
export interface PageRecord {
  readonly id: string
  /** Parent page id, or null for a top-level page. */
  readonly parentId: string | null
  readonly title: string
  readonly icon: string | null
  /** Position among siblings. Lower first; ties keep creation order. */
  readonly order: number
  /** When the page was moved to trash (ms since epoch), or null. Only the page that was trashed has it. */
  readonly trashedAt: number | null
  readonly createdAt: number
}

/** Where page records are kept. Writes must be atomic per call. */
export interface RegistryStorage {
  list(): Promise<readonly PageRecord[]>
  /** Writes all records in one atomic step (all or none). */
  putMany(records: readonly PageRecord[]): Promise<void>
  /** Removes all ids in one atomic step. */
  removeMany(ids: readonly string[]): Promise<void>
}

export type RegistryErrorCode = 'unknown_page' | 'cycle' | 'parent_trashed' | 'not_trashed' | 'invalid_title'

export class RegistryError extends Error {
  readonly code: RegistryErrorCode
  constructor(code: RegistryErrorCode, message: string) {
    super(message)
    this.name = 'RegistryError'
    this.code = code
  }
}

/** Returned by every change: running `undo` puts the records back as they were, once. */
export interface Undoable {
  readonly undo: () => Promise<void>
}

export interface CreateOptions {
  readonly id?: string
  readonly parentId?: string | null
  readonly title?: string
  readonly icon?: string | null
  /** Position among siblings; default is last. */
  readonly index?: number
}

export interface PageRegistry {
  /** Live (not trashed, and no trashed ancestor) children of `parentId`, in order. `null` lists the top level. */
  children(parentId: string | null): Promise<readonly PageRecord[]>
  get(id: string): Promise<PageRecord | null>
  /** Ancestors from the top level down to the parent of `id`. */
  path(id: string): Promise<readonly PageRecord[]>
  /** Trashed pages that were trashed directly (their subtree comes back with them). */
  trash(): Promise<readonly PageRecord[]>
  create(options?: CreateOptions): Promise<PageRecord & Undoable>
  rename(id: string, title: string): Promise<Undoable>
  /** Moves a page (with its subtree) under `parentId` at `index`. A page cannot move into itself or its own subtree. */
  move(id: string, parentId: string | null, index?: number): Promise<Undoable>
  /** Moves a page and its subtree to trash. Bodies stay in the store. */
  moveToTrash(id: string): Promise<Undoable>
  /** Brings a trashed page back under its old parent, or at the top level if that parent is gone or trashed. */
  restore(id: string): Promise<Undoable>
  /** Removes a trashed page, its whole subtree and every body, for good. Not undoable. */
  deleteForever(id: string): Promise<void>
}

export interface RegistryOptions {
  readonly storage: RegistryStorage
  /** Used to delete bodies on `deleteForever`. */
  readonly pages: PageStore
  /** When given, `deleteForever` also removes the files of every deleted page. */
  readonly blobs?: BlobStore
  readonly now?: () => number
  readonly newId?: () => string
}

const defaultId = (): string => 'p' + crypto.randomUUID().replace(/-/g, '').slice(0, 12)

/**
 * The page tree. Pages are addressed by stable id; parents, order and trash state are stored here and the
 * body in the page store, so a title, a move or a trash never copies or rewrites a body. Each change is one
 * atomic storage write and returns an `undo` that restores the previous records.
 */
export function createPageRegistry(options: RegistryOptions): PageRegistry {
  const { storage, pages, blobs, now = Date.now, newId = defaultId } = options

  const load = async () => new Map((await storage.list()).map((record) => [record.id, record]))
  const need = (all: Map<string, PageRecord>, id: string): PageRecord => {
    const found = all.get(id)
    if (!found) throw new RegistryError('unknown_page', `No page "${id}".`)
    return found
  }
  const subtreeIds = (all: Map<string, PageRecord>, id: string): string[] => {
    const out = [id]
    for (let i = 0; i < out.length; i += 1) {
      for (const record of all.values()) if (record.parentId === out[i]) out.push(record.id)
    }
    return out
  }
  const trashedAbove = (all: Map<string, PageRecord>, record: PageRecord): boolean => {
    const seen = new Set<string>()
    let cursor: PageRecord | undefined = record
    while (cursor) {
      if (cursor.trashedAt !== null) return true
      if (cursor.parentId === null || seen.has(cursor.id)) return false
      seen.add(cursor.id)
      cursor = all.get(cursor.parentId)
    }
    return false
  }
  const siblings = (all: Map<string, PageRecord>, parentId: string | null, except?: string): PageRecord[] =>
    [...all.values()]
      .filter((r) => r.parentId === parentId && r.trashedAt === null && r.id !== except)
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)

  /** Writes `after` and returns an undo that writes back `before` (and removes records that did not exist). */
  const commit = async (before: readonly PageRecord[], after: readonly PageRecord[]): Promise<Undoable> => {
    await storage.putMany(after)
    const existed = new Set(before.map((r) => r.id))
    const created = after.filter((r) => !existed.has(r.id)).map((r) => r.id)
    let done = false
    return {
      undo: async () => {
        if (done) return
        done = true
        if (before.length > 0) await storage.putMany(before)
        if (created.length > 0) await storage.removeMany(created)
      },
    }
  }

  /** Renumber so `moving` sits at `index` among its new siblings; returns changed sibling records. */
  const place = (list: PageRecord[], moving: PageRecord, index: number | undefined): PageRecord[] => {
    const at = index === undefined ? list.length : Math.max(0, Math.min(list.length, Math.floor(index)))
    const ordered = [...list.slice(0, at), moving, ...list.slice(at)]
    return ordered.map((record, i) => (record.order === i ? record : { ...record, order: i }))
  }

  return {
    async children(parentId) {
      const all = await load()
      if (parentId !== null) {
        const parent = all.get(parentId)
        if (!parent || trashedAbove(all, parent)) return []
      }
      return siblings(all, parentId)
    },
    async get(id) {
      return (await load()).get(id) ?? null
    },
    async path(id) {
      const all = await load()
      const out: PageRecord[] = []
      const seen = new Set<string>([id])
      let cursor = need(all, id).parentId
      while (cursor !== null && !seen.has(cursor)) {
        const record = all.get(cursor)
        if (!record) break
        seen.add(cursor)
        out.unshift(record)
        cursor = record.parentId
      }
      return out
    },
    async trash() {
      const all = await load()
      return [...all.values()]
        .filter((r) => r.trashedAt !== null)
        .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0))
    },

    async create(createOptions = {}) {
      const all = await load()
      const parentId = createOptions.parentId ?? null
      if (parentId !== null) {
        const parent = need(all, parentId)
        if (trashedAbove(all, parent)) throw new RegistryError('parent_trashed', 'The parent page is in the trash.')
      }
      const id = createOptions.id ?? newId()
      if (all.has(id)) throw new RegistryError('invalid_title', `A page with id "${id}" already exists.`)
      const record: PageRecord = {
        id,
        parentId,
        title: createOptions.title ?? '',
        icon: createOptions.icon ?? null,
        order: 0,
        trashedAt: null,
        createdAt: now(),
      }
      const placed = place(siblings(all, parentId), record, createOptions.index)
      const changed = placed.filter((r) => r.id === id || all.get(r.id)?.order !== r.order)
      const undoable = await commit(
        changed.filter((r) => r.id !== id).map((r) => need(all, r.id)),
        changed,
      )
      return { ...(placed.find((r) => r.id === id) ?? record), ...undoable }
    },

    async rename(id, title) {
      if (typeof title !== 'string' || title.length > 500)
        throw new RegistryError('invalid_title', 'Titles are text of at most 500 characters.')
      const all = await load()
      const record = need(all, id)
      return commit([record], [{ ...record, title }])
    },

    async move(id, parentId, index) {
      const all = await load()
      const record = need(all, id)
      if (parentId !== null) {
        const parent = need(all, parentId)
        if (subtreeIds(all, id).includes(parentId))
          throw new RegistryError('cycle', 'A page cannot move into itself or one of its own subpages.')
        if (trashedAbove(all, parent)) throw new RegistryError('parent_trashed', 'The target page is in the trash.')
      }
      const target = siblings(all, parentId, id)
      const placed = place(target, { ...record, parentId }, index)
      const changed = placed.filter(
        (r) => r.id === id || all.get(r.id)?.order !== r.order || all.get(r.id)?.parentId !== r.parentId,
      )
      // Siblings left behind keep their relative order (gaps are harmless), so only the target list is renumbered.
      return commit(
        changed.map((r) => need(all, r.id)),
        changed,
      )
    },

    async moveToTrash(id) {
      const all = await load()
      const record = need(all, id)
      if (record.trashedAt !== null) return { undo: () => Promise.resolve() }
      return commit([record], [{ ...record, trashedAt: now() }])
    },

    async restore(id) {
      const all = await load()
      const record = need(all, id)
      if (record.trashedAt === null) throw new RegistryError('not_trashed', 'This page is not in the trash.')
      const parent = record.parentId === null ? undefined : all.get(record.parentId)
      const parentId = parent && !trashedAbove(all, parent) ? record.parentId : null
      const placed = place(siblings(all, parentId, id), { ...record, parentId, trashedAt: null }, undefined)
      const changed = placed.filter((r) => r.id === id || all.get(r.id)?.order !== r.order)
      return commit(
        changed.map((r) => need(all, r.id)),
        changed,
      )
    },

    async deleteForever(id) {
      const all = await load()
      const record = need(all, id)
      if (record.trashedAt === null)
        throw new RegistryError('not_trashed', 'Only a page in the trash can be deleted for good.')
      const ids = subtreeIds(all, id)
      // Bodies first: if one fails the records stay and the page is still in the trash to try again.
      for (const pageId of ids) {
        await pages.remove(pageId)
        await blobs?.removePage(pageId)
      }
      await storage.removeMany(ids)
    },
  }
}

/** In-memory registry storage for tests and hosts that persist elsewhere. */
export function createMemoryRegistryStorage(): RegistryStorage {
  const records = new Map<string, PageRecord>()
  return {
    list: () => Promise.resolve([...records.values()]),
    putMany: (list) => {
      for (const record of list) records.set(record.id, record)
      return Promise.resolve()
    },
    removeMany: (ids) => {
      for (const id of ids) records.delete(id)
      return Promise.resolve()
    },
  }
}
