import type { Editor, JSONContent } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import { collectDescendantIds } from './messageTree'
import { COMMENT_AUTHOR, COMMENTS_FORMAT, type CommentThread } from './types'

const isThread = (value: unknown): value is CommentThread =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as CommentThread).id === 'string' &&
  Array.isArray((value as CommentThread).messages) &&
  ((value as CommentThread).status === 'open' || (value as CommentThread).status === 'resolved')

const load = (storageKey: string): { threads: CommentThread[]; dropped: number } => {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as unknown
    const list = Array.isArray(raw)
      ? raw
      : typeof raw === 'object' && raw !== null && Array.isArray((raw as { threads?: unknown }).threads)
        ? ((raw as { threads: unknown[] }).threads as unknown[])
        : []
    const threads = list.filter(isThread)
    // Entries that fail validation are dropped: the panel discloses this instead of losing them silently.
    return { threads, dropped: list.length - threads.length }
  } catch {
    return { threads: [], dropped: 0 }
  }
}

/** Collects the thread ids whose comment mark is still present in the document. */
const markedThreadIds = (
  doc: JSONContent,
  found = new Map<string, 'text' | 'block'>(),
): Map<string, 'text' | 'block'> => {
  for (const mark of doc.marks ?? [])
    if (mark.type === 'comment' && mark.attrs?.threadId) found.set(mark.attrs.threadId as string, 'text')
  const blockThread = doc.attrs?.commentThread
  if (typeof blockThread === 'string' && blockThread) found.set(blockThread, 'block')
  for (const child of doc.content ?? []) markedThreadIds(child, found)
  return found
}

/**
 * Local-first comment threads (F1). Thread content lives here, keyed by document id; anchors
 * live in the document as comment marks, so edits/undo/redo/version-restore move or remove them
 * naturally. The store mirrors the document on every transaction: a thread whose mark vanished
 * (its text was deleted) is flagged orphaned and kept - comment content is never silently lost.
 */
export class CommentStore {
  private readonly storageKey: string
  private readonly now: () => number
  private threads: CommentThread[]
  /** Deleted this session: undo of the anchor removal restores the thread, messages intact.
   *  Never persisted - a deleted thread is truly gone after reload. */
  private readonly tombstones = new Map<string, CommentThread>()
  /** Threads restored by undo whose deletion is still the latest history entry: a redo (anchor
   *  leaves again under a history transaction) re-deletes them. Any new edit seals the set -
   *  the redo stack is gone, so normal orphan rules apply from then on. */
  private readonly pendingRestore = new Set<string>()
  private sequence = 0
  private readonly listeners = new Set<() => void>()
  /** Persisted entries dropped as corrupt at load (disclosed in the panel). */
  readonly droppedCorrupt: number
  /** True when the last persist failed: threads are memory-only until it succeeds again. */
  private persistenceDegraded = false

  constructor(storageKey: string, options: { now?: () => number } = {}) {
    this.storageKey = storageKey
    this.now = options.now ?? Date.now
    const stored = load(storageKey)
    this.threads = stored.threads
    this.droppedCorrupt = stored.dropped
  }

  isPersistenceDegraded(): boolean {
    return this.persistenceDegraded
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }

  /** Newest activity first. */
  list(): readonly CommentThread[] {
    return this.threads
  }

  get(id: string): CommentThread | undefined {
    return this.threads.find((thread) => thread.id === id)
  }

  private nextId(prefix: string): string {
    this.sequence += 1
    return `${prefix}-${this.now()}-${this.sequence}`
  }

  private update(id: string, change: (thread: CommentThread) => CommentThread): void {
    const current = this.get(id)
    if (!current) return
    const next = change(current)
    this.threads = [next, ...this.threads.filter((thread) => thread.id !== id)]
    this.persist()
    this.emit()
  }

  /** Starts a thread; the caller anchors it (mark or block attribute) in the same action. */
  createThread(text: string, anchorKind: 'text' | 'block' = 'text'): CommentThread {
    const thread: CommentThread = {
      id: this.nextId('thread'),
      anchorKind,
      messages: [{ id: this.nextId('msg'), author: COMMENT_AUTHOR, text, createdAt: this.now() }],
      status: 'open',
      createdAt: this.now(),
    }
    this.threads = [thread, ...this.threads]
    this.persist()
    this.emit()
    return thread
  }

  reply(threadId: string, text: string, parentId?: string): void {
    this.update(threadId, (thread) => ({
      ...thread,
      messages: [
        ...thread.messages,
        {
          id: this.nextId('msg'),
          author: COMMENT_AUTHOR,
          text,
          createdAt: this.now(),
          ...(parentId ? { parentId } : {}),
        },
      ],
    }))
  }

  editMessage(threadId: string, messageId: string, text: string): void {
    this.update(threadId, (thread) => ({
      ...thread,
      messages: thread.messages.map((message) =>
        message.id === messageId ? { ...message, text, editedAt: this.now() } : message,
      ),
    }))
  }

  /** Removes a message and nested replies; empty threads are dropped (anchor removal is the caller's job). */
  deleteMessage(threadId: string, messageId: string): void {
    const thread = this.get(threadId)
    if (!thread) return
    const removeIds = collectDescendantIds(thread.messages, messageId)
    const remaining = thread.messages.filter((message) => !removeIds.has(message.id))
    if (remaining.length === 0) {
      this.deleteThread(threadId)
      return
    }
    this.update(threadId, (current) => ({
      ...current,
      messages: remaining,
    }))
  }

  resolve(threadId: string): void {
    this.update(threadId, (thread) => ({ ...thread, status: 'resolved' }))
  }

  reopen(threadId: string): void {
    this.update(threadId, (thread) => ({ ...thread, status: 'open' }))
  }

  deleteThread(threadId: string): void {
    const thread = this.get(threadId)
    if (!thread) return
    this.tombstones.set(threadId, thread)
    this.threads = this.threads.filter((candidate) => candidate.id !== threadId)
    this.persist()
    this.emit()
  }

  /**
   * Mirrors the document after any transaction: threads whose anchor is gone are flagged
   * orphaned (content kept); threads whose anchor came back (undo, version restore) heal; an
   * anchor whose thread was deleted this session restores the original thread with its
   * messages (undo of the deletion), and the matching redo deletes it again. Anchors with an
   * unknown thread id - only possible from corrupt or foreign documents - are left alone,
   * never turned into empty threads.
   */
  syncWithDocument(editor: Editor, tr?: Transaction): void {
    const present = markedThreadIds(editor.getJSON())
    if (tr && !tr.getMeta('history$')) this.pendingRestore.clear()
    let changed = false
    const kept: CommentThread[] = []
    for (const thread of this.threads) {
      if (!present.has(thread.id) && this.pendingRestore.has(thread.id)) {
        // Redo of the deletion: back to the tombstone, messages intact.
        this.pendingRestore.delete(thread.id)
        this.tombstones.set(thread.id, { ...thread, orphaned: undefined })
        changed = true
        continue
      }
      const orphaned = !present.has(thread.id)
      if ((thread.orphaned ?? false) === orphaned) {
        kept.push(thread)
        continue
      }
      changed = true
      kept.push(orphaned ? { ...thread, orphaned: true } : { ...thread, orphaned: undefined })
    }
    this.threads = kept
    for (const threadId of present.keys()) {
      if (this.threads.some((thread) => thread.id === threadId)) continue
      const tombstone = this.tombstones.get(threadId)
      if (!tombstone) continue
      this.tombstones.delete(threadId)
      this.pendingRestore.add(threadId)
      this.threads = [{ ...tombstone, orphaned: undefined }, ...this.threads]
      changed = true
    }
    if (changed) {
      this.persist()
      this.emit()
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({ format: COMMENTS_FORMAT, threads: this.threads }))
      this.persistenceDegraded = false
    } catch {
      // Quota: comments stay in memory; the panel discloses this instead of claiming durability.
      this.persistenceDegraded = true
    }
  }
}

const storeCache = new WeakMap<Editor, CommentStore>()

/** The CommentStore for this editor's document (identity shared with the version history). */
export const getCommentStore = (editor: Editor): CommentStore => {
  const existing = storeCache.get(editor)
  if (existing) return existing
  const documentId = editor.storage.documentIdentity?.documentId ?? 'default'
  const store = new CommentStore(`page:comments:${documentId}`)
  storeCache.set(editor, store)
  return store
}
