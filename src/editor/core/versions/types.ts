import type { JSONContent } from '@tiptap/core'

/** How one document-changing transaction is classified for version history. */
export type ChangeKind = 'operation' | 'typing' | 'paste' | 'undo' | 'redo' | 'drop' | 'program' | 'other'

export interface VersionChange {
  readonly kind: ChangeKind
  /** Named operation id when the change came through the operations layer. */
  readonly operationId?: string
}

/** Storage/format version of entries, so future schema or collaboration migrations can tell. */
export const VERSION_SCHEMA = 1

/** Version of the whole stored container (entries + event log); 1 was a bare entry array. */
export const STORAGE_FORMAT = 2

/**
 * One document-changing transaction preserved as a durable event: the operation log behind the
 * snapshots. `steps` is the replayable payload (ProseMirror Step.toJSON()), so a future
 * collaboration layer (Yjs or otherwise) can rebase/replay within the retained window instead of
 * only diffing snapshots. The log is bounded locally (oldest events trimmed); snapshots anchor
 * the long term. Honest boundary: this preserves local operation data, it is not yet a CRDT.
 */
export interface VersionEvent {
  readonly id: string
  readonly schemaVersion: number
  /** Global ordering across reloads, restored from the persisted log. Replay requires ascending seq. */
  readonly seq: number
  readonly at: number
  readonly kind: ChangeKind
  /** Named operation id when the transaction came through the operations layer. */
  readonly operationId?: string
  /** Serialized ProseMirror steps (Step.toJSON()); empty when a step fails to serialize. */
  readonly steps: readonly unknown[]
}

export interface VersionEntry {
  readonly id: string
  readonly schemaVersion: number
  readonly createdAt: number
  /** 'auto' (idle checkpoint) or 'manual' (user-saved version). */
  readonly trigger: 'auto' | 'manual'
  /** Optional user-facing name for manual versions. */
  readonly label?: string
  /** Optional note the user wrote about this version. */
  readonly description?: string
  /**
   * The version this one emerged from. History can fork when you restore an older version and
   * keep writing: the new work parents to that version, and the line you left stays in place.
   * Absent on older saved versions. This is not a git commit, and it is not the undo stack.
   * Undo/redo and a future collaborative log stay on the operation events.
   */
  readonly parentId?: string
  /** Human-readable summary of what changed since the previous snapshot. */
  readonly changes: readonly VersionChange[]
  /**
   * Replay baseline: events with seq <= lastEventSeq are already contained in this snapshot;
   * events above it replay onto it in ascending seq order. Absent on legacy (format-1) entries.
   */
  readonly lastEventSeq?: number
  /** Full document snapshot (local-first; replaceable by Yjs updates later). */
  readonly doc: JSONContent
}
