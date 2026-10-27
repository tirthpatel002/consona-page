import type { Editor } from '@tiptap/core'
import type { Schema } from '@tiptap/pm/model'
import {
  isBlockId,
  searchPages,
  StaleRevisionError,
  type JsonObject,
  type PageListRegistry,
  type PageSearchResponse,
  type PageSettingsStore,
  type PageStore,
  type SearchOptions,
} from '../core'
import type { CompactOptions, CompactText, MarkdownCodec } from './compact'
import { createPageEngine, type EditRequest, type EditResult, type PageEngine, type Step } from './engine'
import type { RequestLog } from './requestLog'

export type PageErrorCode =
  | 'unknown_page'
  | 'trashed'
  | 'locked'
  | 'conflict'
  | 'ids_missing'
  | 'store_failed'
  | 'invalid_title'
  | 'cycle'
  | 'parent_trashed'
  | 'not_trashed'
  | 'registry_failed'

export interface PageError {
  readonly code: PageErrorCode
  readonly message: string
}

export type PageFailure = { readonly ok: false; readonly errors: readonly PageError[] }

export interface PagesEngineOptions {
  readonly registry: PageListRegistry
  readonly store: PageStore
  readonly settings: PageSettingsStore
  readonly markdown: MarkdownCodec
  /** Makes a detached editor (no screen) that holds `doc`, with the same schema as the page editor. Called for pages that are not open. */
  readonly createEditor: (doc: JsonObject | null) => { readonly editor: Editor; readonly destroy: () => void }
  readonly requestLog?: RequestLog
}

export type EditOutcome = EditResult | PageFailure

export interface PagesEngine {
  /** Registers the editor that has page `pageId` open, so the engine works through it. Returns a function that detaches it. */
  attach(pageId: string, editor: Editor): () => void
  children(parentId: string | null): Promise<readonly { id: string; title: string }[]>
  search(query: string, options?: SearchOptions): Promise<PageSearchResponse>
  /** Makes a page. `text` is Markdown (paragraphs, headings, lists, quotes, code, tables). */
  create(options: {
    parent?: string | null
    title?: string
    text?: string
  }): Promise<{ readonly ok: true; readonly id: string; readonly revision: string } | PageFailure>
  rename(id: string, title: string): Promise<{ readonly ok: true } | PageFailure>
  move(id: string, parent: string | null, index?: number): Promise<{ readonly ok: true } | PageFailure>
  trash(id: string): Promise<{ readonly ok: true } | PageFailure>
  restore(id: string): Promise<{ readonly ok: true } | PageFailure>
  readCompact(
    id: string,
    options?: Omit<CompactOptions, 'ids'> & { readonly ids?: readonly string[] },
  ): Promise<({ readonly ok: true } & CompactText & { readonly revision: string }) | PageFailure>
  outline(id: string): Promise<({ readonly ok: true } & ReturnType<PageEngine['outline']>) | PageFailure>
  edit(id: string, request: EditRequest): Promise<EditOutcome>
  undo(id: string): Promise<EditOutcome>
}

const fail = (code: PageErrorCode, message: string): PageFailure => ({ ok: false, errors: [{ code, message }] })

/** Every node whose type takes a block id carries a valid one (checked on the stored JSON, so an old page is not silently rewritten). */
const hasAllIds = (node: unknown, schema: Schema): boolean => {
  if (typeof node !== 'object' || node === null) return true
  const n = node as { type?: string; attrs?: { blockId?: unknown }; content?: unknown[] }
  const type = n.type ? schema.nodes[n.type] : undefined
  if (type && type.spec.attrs && 'blockId' in type.spec.attrs && !isBlockId(n.attrs?.blockId)) return false
  return (n.content ?? []).every((child) => hasAllIds(child, schema))
}

/**
 * Page-level engine: the page tree and bodies by id. An open page is edited through its editor, a closed page
 * on its stored copy through a detached editor, with the same rules and steps either way. Closed-page writes
 * check the stored revision, so a write from another tab is reported as a conflict and never overwritten.
 */
export function createPagesEngine(options: PagesEngineOptions): PagesEngine {
  const { registry, store, settings, markdown, createEditor, requestLog } = options
  const open = new Map<string, { editor: Editor; engine: PageEngine }>()
  /** Last closed-page batch per page, for undo: the body before it, and the store revision after it. */
  const closedUndo = new Map<string, { before: JsonObject; afterRevision: number }>()

  const guard = async (id: string, writing: boolean): Promise<PageFailure | null> => {
    const record = await registry.get(id)
    if (!record) return fail('unknown_page', `No page "${id}".`)
    if (writing) {
      const ancestors = await registry.path(id)
      if (record.trashedAt !== null || ancestors.some((a) => a.trashedAt !== null)) {
        return fail('trashed', 'The page is in the trash, so it cannot be changed. Restore it first.')
      }
      if ((await settings.get(id)).locked) return fail('locked', 'The page is locked, so the engine cannot change it.')
    }
    return null
  }

  const registryFailure = (error: unknown): PageFailure => {
    const code = (error as { code?: string }).code
    const known: Record<string, PageErrorCode> = {
      unknown_page: 'unknown_page',
      cycle: 'cycle',
      parent_trashed: 'parent_trashed',
      not_trashed: 'not_trashed',
      invalid_title: 'invalid_title',
    }
    return fail(
      (code && known[code]) || 'registry_failed',
      error instanceof Error ? error.message : 'The page list could not be changed.',
    )
  }

  /** Runs `work` on a detached editor holding the stored body. */
  const withClosed = async <T>(
    id: string,
    work: (ctx: { editor: Editor; engine: PageEngine; revision: number; doc: JsonObject }) => Promise<T> | T,
  ): Promise<T | PageFailure> => {
    let stored
    try {
      stored = await store.get(id)
    } catch (error) {
      return fail('store_failed', error instanceof Error ? error.message : 'The page could not be read.')
    }
    if (!stored) return fail('unknown_page', `Page "${id}" has no saved body.`)
    const { editor, destroy } = createEditor(stored.doc)
    try {
      if (!hasAllIds(stored.doc, editor.schema)) {
        return fail(
          'ids_missing',
          'This page has blocks without ids. Open it in the editor once so they are assigned and saved.',
        )
      }
      return await work({
        editor,
        engine: createPageEngine({ editor, markdown }),
        revision: stored.revision,
        doc: stored.doc,
      })
    } finally {
      destroy()
    }
  }

  const route = async <T>(
    id: string,
    onOpen: (engine: PageEngine) => T,
    onClosed: (ctx: { editor: Editor; engine: PageEngine; revision: number; doc: JsonObject }) => Promise<T> | T,
  ): Promise<T | PageFailure> => {
    const live = open.get(id)
    if (live && !live.editor.isDestroyed) return onOpen(live.engine)
    return withClosed(id, onClosed)
  }

  return {
    attach(pageId, editor) {
      const entry = { editor, engine: createPageEngine({ editor, markdown }) }
      open.set(pageId, entry)
      return () => {
        if (open.get(pageId) === entry) open.delete(pageId)
      }
    },

    async children(parentId) {
      return (await registry.children(parentId)).map((r) => ({ id: r.id, title: r.title }))
    },

    search: (query, searchOptions) => searchPages({ registry, pages: store }, query, searchOptions),

    async create({ parent = null, title, text }) {
      // Build and check the body first, so a refused text never leaves a page behind.
      const { editor, destroy } = createEditor(null)
      let body: JsonObject
      let revision: string
      try {
        const engine = createPageEngine({ editor, markdown })
        if (text !== undefined && text.trim() !== '') {
          const first = engine.outline().blocks[0]
          if (!first) return fail('store_failed', 'The new page has no first block.')
          const result = engine.edit({
            baseRevision: engine.revision(),
            requestId: 'create',
            steps: [
              { op: 'insertMarkdownAfter', id: first.id, text },
              { op: 'delete', id: first.id },
            ],
          })
          if (!result.ok) {
            return fail(
              'store_failed',
              `The text was not accepted (${result.errors[0]?.code ?? 'error'}): ${result.errors[0]?.message ?? ''}`,
            )
          }
        }
        body = editor.getJSON() as JsonObject
        revision = engine.revision()
      } finally {
        destroy()
      }
      let id: string | null = null
      try {
        const record = await registry.create({ parentId: parent, ...(title !== undefined ? { title } : {}) })
        id = record.id
        await store.put(id, body, { expectedRevision: null })
        return { ok: true as const, id, revision }
      } catch (error) {
        // A record without a body would show an unreadable page, so take it back out.
        if (id !== null) {
          try {
            await registry.moveToTrash(id)
            await registry.deleteForever(id)
          } catch {
            /* the record stays in the trash; the caller is told the page was not made */
          }
        }
        return (error as { code?: string }).code
          ? registryFailure(error)
          : fail('store_failed', error instanceof Error ? error.message : 'The page could not be created.')
      }
    },

    async rename(id, title) {
      try {
        await registry.rename(id, title)
        return { ok: true as const }
      } catch (error) {
        return registryFailure(error)
      }
    },
    async move(id, parent, index) {
      try {
        await registry.move(id, parent, index)
        return { ok: true as const }
      } catch (error) {
        return registryFailure(error)
      }
    },
    async trash(id) {
      try {
        await registry.moveToTrash(id)
        return { ok: true as const }
      } catch (error) {
        return registryFailure(error)
      }
    },
    async restore(id) {
      try {
        await registry.restore(id)
        return { ok: true as const }
      } catch (error) {
        return registryFailure(error)
      }
    },

    async readCompact(id, readOptions) {
      const missing = await guard(id, false)
      if (missing) return missing
      const result = await route(
        id,
        (engine) => engine.readCompact(readOptions),
        ({ engine }) => engine.readCompact(readOptions),
      )
      if (result === null) return fail('store_failed', 'No Markdown converter is configured.')
      if ('ok' in result) return result
      return { ok: true as const, ...result }
    },

    async outline(id) {
      const missing = await guard(id, false)
      if (missing) return missing
      const result = await route(
        id,
        (engine) => engine.outline(),
        ({ engine }) => engine.outline(),
      )
      return 'ok' in result ? result : { ok: true as const, ...result }
    },

    async edit(id, request) {
      const blocked = await guard(id, true)
      if (blocked) return blocked
      const logged = await requestLog?.get(id, request.requestId).catch(() => null)
      if (logged) return { ok: true, revision: logged.revision, applied: logged.applied, replayed: true }
      const outcome = await route<EditOutcome>(
        id,
        (engine) => engine.edit(request),
        async ({ editor, engine, revision, doc }) => {
          const result = engine.edit(request)
          if (!result.ok || result.applied === 0) return result
          let saved
          try {
            saved = await store.put(id, editor.getJSON() as JsonObject, { expectedRevision: revision })
          } catch (error) {
            if (error instanceof StaleRevisionError) {
              return fail(
                'conflict',
                'The page was saved somewhere else while this edit ran. Nothing was changed. Read it again.',
              )
            }
            return fail(
              'store_failed',
              error instanceof Error ? error.message : 'The page could not be saved. Nothing was changed.',
            )
          }
          closedUndo.set(id, { before: doc, afterRevision: saved.revision })
          return result
        },
      )
      if (outcome.ok && !outcome.replayed && outcome.applied > 0) {
        // A failure to remember the request only costs idempotency across reloads; the edit itself is done.
        await requestLog
          ?.put(id, request.requestId, { revision: outcome.revision, applied: outcome.applied })
          .catch(() => undefined)
      }
      return outcome
    },

    async undo(id) {
      const blocked = await guard(id, true)
      if (blocked) return blocked
      const live = open.get(id)
      if (live && !live.editor.isDestroyed) return live.engine.undo()
      const entry = closedUndo.get(id)
      if (!entry) return { ok: false, errors: [{ code: 'nothing_to_undo', message: 'No closed-page batch to undo.' }] }
      try {
        const saved = await store.put(id, entry.before, { expectedRevision: entry.afterRevision })
        closedUndo.delete(id)
        const done = await withClosed(id, ({ engine }) => engine.revision())
        if (typeof done !== 'string') return done
        void saved
        return { ok: true, revision: done, applied: 1, replayed: false }
      } catch (error) {
        if (error instanceof StaleRevisionError) {
          return {
            ok: false,
            errors: [
              {
                code: 'changed_since',
                message: 'The page changed after that batch, so it cannot be undone without losing those changes.',
              },
            ],
          }
        }
        return fail('store_failed', error instanceof Error ? error.message : 'The page could not be saved.')
      }
    },
  }
}

export type { Step }
