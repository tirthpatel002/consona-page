import type { Editor } from '@tiptap/core'
import { classifyTransaction, summarizeChanges } from './classify'
import { STORAGE_FORMAT, VERSION_SCHEMA } from './types'
import type { VersionChange, VersionEntry, VersionEvent } from './types'

const MAX_VERSIONS = 50
/** Bounded local window of preserved transaction events (oldest trimmed first). */
const MAX_EVENTS = 200
/** Idle time after the last change before an automatic checkpoint is taken. */
export const AUTO_IDLE_MS = 5000
/** Minimum spacing between automatic checkpoints (active writing batches into one). */
export const AUTO_MIN_INTERVAL_MS = 30000

export interface VersionStoreOptions {
  /** localStorage key for this document's versions. */
  readonly storageKey?: string
  readonly maxVersions?: number
  readonly maxEvents?: number
  readonly now?: () => number
  /**
   * Subscribe to transactions immediately (default true). Pass false when an outer lifecycle
   * (e.g. a React effect) owns attach/destroy, so a discarded instance never listens.
   */
  readonly attach?: boolean
}

const DEFAULT_KEY = 'page:versions:default'

const isEntry = (entry: unknown): entry is VersionEntry =>
  typeof entry === 'object' &&
  entry !== null &&
  typeof (entry as VersionEntry).id === 'string' &&
  typeof (entry as VersionEntry).createdAt === 'number' &&
  (entry as VersionEntry).doc !== undefined

const isEvent = (event: unknown): event is VersionEvent =>
  typeof event === 'object' &&
  event !== null &&
  typeof (event as VersionEvent).id === 'string' &&
  typeof (event as VersionEvent).at === 'number' &&
  Array.isArray((event as VersionEvent).steps)

/** Reads both the snapshot entries and the event log; migrates the legacy bare entry array. */
const load = (storageKey: string): { entries: VersionEntry[]; events: VersionEvent[] } => {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as unknown
    if (Array.isArray(raw)) return { entries: raw.filter(isEntry), events: [] }
    if (typeof raw === 'object' && raw !== null) {
      const container = raw as { entries?: unknown; events?: unknown }
      return {
        entries: Array.isArray(container.entries) ? container.entries.filter(isEntry) : [],
        events: Array.isArray(container.events) ? container.events.filter(isEvent) : [],
      }
    }
    return { entries: [], events: [] }
  } catch {
    return { entries: [], events: [] }
  }
}

/**
 * Local-first version history (E1/E2). Captures EVERY document-changing transaction - typing,
 * paste, drop, undo/redo, named operations, programmatic changes - checkpoints the document after
 * an idle gap (batched when writing continuously), and keeps manual versions pinned ahead of auto
 * ones when trimming. Local-only: nothing is logged or sent anywhere. The capture boundary is the
 * transaction stream, so a future Yjs source can feed the same snapshot/diff pipeline.
 */
export class VersionStore {
  private readonly editor: Editor
  private readonly storageKey: string
  private readonly maxVersions: number
  private readonly maxEvents: number
  private readonly now: () => number
  private versions: VersionEntry[]
  private events: VersionEvent[]
  private pending: VersionChange[] = []
  private lastSnapshotAt = 0
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private sequence = 0
  private eventSequence = 0
  /** True when the last persist failed even after the quota retry: history is memory-only. */
  private persistenceDegraded = false
  /** While true, the in-flight transaction is a restore and must not become its own version. */
  private suppressSnapshot = false
  /** The saved version the user restored. Stays current until they edit the page. */
  private restoredId: string | null = null
  /**
   * Parent of the next snapshot. Set when the user restores, and kept across the edits that
   * follow so the new version emerges from that restore. Undo/redo drops it: those are local
   * history, not a new line of versions.
   */
  private nextParentId: string | null = null
  private readonly listeners = new Set<() => void>()
  private attached = false

  constructor(editor: Editor, options: VersionStoreOptions = {}) {
    this.editor = editor
    this.storageKey = options.storageKey ?? DEFAULT_KEY
    this.maxVersions = options.maxVersions ?? MAX_VERSIONS
    this.maxEvents = options.maxEvents ?? MAX_EVENTS
    this.now = options.now ?? Date.now
    const stored = load(this.storageKey)
    this.versions = stored.entries
    this.events = stored.events
    // Continue the global ordering across reloads so replay order is never ambiguous.
    this.eventSequence = stored.events.reduce((max, event) => Math.max(max, event.seq), 0)
    if (options.attach !== false) this.attach()
  }

  /** Subscribes to the editor's transaction stream. Safe to call again after destroy. */
  attach(): void {
    if (this.attached) return
    this.attached = true
    this.editor.on('transaction', this.onTransaction)
  }

  destroy(): void {
    if (!this.attached) return
    this.attached = false
    this.editor.off('transaction', this.onTransaction)
    if (this.idleTimer) clearTimeout(this.idleTimer)
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Newest first. */
  list(): readonly VersionEntry[] {
    return this.versions
  }

  /**
   * The saved version that is the page right now: the one the user restored, or the newest
   * snapshot whose document matches. Null when the page has moved on and is not saved yet.
   */
  currentVersionId(): string | null {
    if (this.restoredId && this.get(this.restoredId)) return this.restoredId
    const doc = JSON.stringify(this.editor.getJSON())
    return this.versions.find((entry) => JSON.stringify(entry.doc) === doc)?.id ?? null
  }

  /**
   * Makes a saved version the page again. Work that is not already a version is checkpointed
   * first, so it can be restored later. The restored version stays that version: the restore
   * itself is not copied into a new timestamp.
   */
  restoreSaved(id: string): boolean {
    const target = this.get(id)
    if (!target) return false
    const doc = JSON.stringify(this.editor.getJSON())
    const alreadySaved = this.versions.some((entry) => JSON.stringify(entry.doc) === doc)
    if (!alreadySaved) this.snapshot('auto', undefined, { force: true })
    this.suppressSnapshot = true
    try {
      this.editor.commands.setContent(target.doc, { emitUpdate: true })
    } finally {
      this.suppressSnapshot = false
    }
    this.pending = []
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
    this.restoredId = target.id
    this.nextParentId = target.id
    for (const listener of this.listeners) listener()
    return true
  }

  /** Oldest first: the bounded window of preserved transaction events behind the snapshots. */
  listEvents(): readonly VersionEvent[] {
    return this.events
  }

  /**
   * True when localStorage refused the last write even after trimming: the visible history is
   * then kept in memory only and would be lost on reload. The UI must say so (E3 disclosure).
   */
  isPersistenceDegraded(): boolean {
    return this.persistenceDegraded
  }

  get(id: string): VersionEntry | undefined {
    return this.versions.find((entry) => entry.id === id)
  }

  /**
   * Names a saved version. A blank name clears the label. Naming also pins the version as manual
   * so trimming keeps it ahead of automatic checkpoints.
   */
  rename(id: string, label: string): boolean {
    const entry = this.get(id)
    if (!entry) return false
    return this.updateDetails(id, { label, description: entry.description ?? '' })
  }

  /**
   * Sets the title and description of a saved version. Blank text clears that field. Writing
   * either one pins the version as manual so trimming keeps it ahead of automatic checkpoints.
   */
  updateDetails(id: string, details: { readonly label: string; readonly description: string }): boolean {
    const index = this.versions.findIndex((entry) => entry.id === id)
    if (index < 0) return false
    const current = this.versions[index]
    const label = details.label.trim()
    const description = details.description.trim()
    const { label: _label, description: _description, ...rest } = current
    const named = label.length > 0 || description.length > 0
    const next: VersionEntry = {
      ...rest,
      ...(label ? { label } : {}),
      ...(description ? { description } : {}),
      ...(named ? { trigger: 'manual' as const } : {}),
    }
    this.versions = this.versions.map((entry, i) => (i === index ? next : entry))
    this.persist()
    for (const listener of this.listeners) listener()
    return true
  }

  private readonly onTransaction = ({
    transaction,
  }: {
    transaction: Parameters<typeof classifyTransaction>[0] & { steps: readonly { toJSON: () => unknown }[] }
  }) => {
    const change = classifyTransaction(transaction)
    if (!change) return
    if (!this.suppressSnapshot) {
      this.pending.push(change)
      this.restoredId = null
      if (change.kind === 'undo' || change.kind === 'redo') this.nextParentId = null
    }
    // Preserve the operation payload behind an extensible event interface (see VersionEvent).
    const steps = ((): unknown[] => {
      try {
        return transaction.steps.map((step) => step.toJSON())
      } catch {
        return []
      }
    })()
    this.eventSequence += 1
    this.events = [
      ...this.events,
      {
        id: `${this.now()}-e${this.eventSequence}`,
        schemaVersion: VERSION_SCHEMA,
        seq: this.eventSequence,
        at: this.now(),
        kind: change.kind,
        ...(change.operationId ? { operationId: change.operationId } : {}),
        steps,
      },
    ]
    this.trimEvents()
    if (this.suppressSnapshot) return
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => this.autoCheckpoint(), AUTO_IDLE_MS)
  }

  private autoCheckpoint(): void {
    if (this.pending.length === 0) return
    const now = this.now()
    if (now - this.lastSnapshotAt < AUTO_MIN_INTERVAL_MS) {
      // Still inside an active writing batch: make the event log durable now, snapshot later.
      this.persist()
      this.idleTimer = setTimeout(() => this.autoCheckpoint(), AUTO_MIN_INTERVAL_MS - (now - this.lastSnapshotAt))
      return
    }
    this.snapshot('auto')
  }

  /**
   * Takes a version of the current document. Returns the entry, or null when nothing changed.
   * `force` checkpoints even without pending changes (used before a restore); a snapshot is still
   * skipped when the document matches the latest version.
   */
  snapshot(
    trigger: 'auto' | 'manual',
    label?: string,
    options?: { force?: boolean; description?: string },
  ): VersionEntry | null {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    if (this.pending.length === 0 && trigger === 'auto' && !options?.force) return null
    const doc = this.editor.getJSON()
    const previous = this.versions[0]
    if (previous && JSON.stringify(previous.doc) === JSON.stringify(doc) && trigger === 'auto') {
      this.pending = []
      return null
    }
    const parentId = this.nextParentId ?? this.currentVersionId() ?? previous?.id
    this.nextParentId = null
    this.sequence += 1
    const description = options?.description?.trim()
    const entry: VersionEntry = {
      id: `${this.now()}-${this.sequence}`,
      schemaVersion: VERSION_SCHEMA,
      createdAt: this.now(),
      trigger,
      ...(label ? { label } : {}),
      ...(description ? { description } : {}),
      ...(parentId ? { parentId } : {}),
      changes: summarizeChanges(this.pending),
      lastEventSeq: this.eventSequence,
      doc,
    }
    this.pending = []
    this.lastSnapshotAt = entry.createdAt
    this.versions = [entry, ...this.versions]
    this.trim()
    this.persist()
    for (const listener of this.listeners) listener()
    return entry
  }

  /**
   * Bounds the event window without breaking replay: only events already anchored by the latest
   * snapshot (seq <= its lastEventSeq) may be dropped; the unanchored tail always stays so the
   * chain latest-snapshot -> tail events remains replayable in ascending seq order.
   */
  private trimEvents(): void {
    const baseline = this.versions[0]?.lastEventSeq ?? 0
    while (this.events.length > this.maxEvents && this.events[0].seq <= baseline) this.events.shift()
  }

  /** Manual versions are kept ahead of auto ones when trimming to the cap. */
  private trim(): void {
    while (this.versions.length > this.maxVersions) {
      const autoIndex = this.versions.map((v) => v.trigger).lastIndexOf('auto')
      this.versions.splice(autoIndex >= 0 ? autoIndex : this.versions.length - 1, 1)
    }
  }

  private persist(): void {
    const write = () =>
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({ format: STORAGE_FORMAT, entries: this.versions, events: this.events }),
      )
    try {
      write()
      this.persistenceDegraded = false
    } catch {
      // quota exceeded: drop the oldest half of both windows and retry once
      this.versions = this.versions.slice(0, Math.ceil(this.versions.length / 2))
      this.events = this.events.slice(Math.floor(this.events.length / 2))
      try {
        write()
        this.persistenceDegraded = false
      } catch {
        // Still failing: history lives in memory only. Disclosed via isPersistenceDegraded().
        this.persistenceDegraded = true
      }
    }
  }
}
