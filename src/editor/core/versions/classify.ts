import type { Transaction } from '@tiptap/pm/state'
import { OPERATION_META } from '../operations/defineOperation'
import type { VersionChange } from './types'

/**
 * Classifies ANY document-changing transaction for version capture - verified at the transaction
 * level, so typing, paste, drop, undo/redo and programmatic changes are all covered, with named
 * operations as labels when the change came through the operations layer.
 */
export const classifyTransaction = (tr: Transaction): VersionChange | null => {
  if (!tr.docChanged) return null
  // A batch applied by the page engine (a program, not a person typing).
  if (tr.getMeta('source') === 'program') return { kind: 'program' }
  const operationId = tr.getMeta(OPERATION_META) as string | undefined
  if (operationId) return { kind: 'operation', operationId }
  const history = tr.getMeta('history$') as { redo?: boolean } | undefined
  if (history) return { kind: history.redo ? 'redo' : 'undo' }
  if (tr.getMeta('paste')) return { kind: 'paste' }
  if (tr.getMeta('uiEvent') === 'drop') return { kind: 'drop' }
  if (tr.getMeta('pointer')) return { kind: 'typing' }
  // Plain typing carries no meta; anything else doc-changing without a label still counts.
  return { kind: 'typing' }
}

/** Collapses a run of classified changes into a compact summary (e.g. 40 keystrokes -> 1 'typing'). */
export const summarizeChanges = (changes: readonly VersionChange[]): readonly VersionChange[] => {
  const out: VersionChange[] = []
  for (const change of changes) {
    const last = out[out.length - 1]
    if (last && last.kind === change.kind && last.operationId === change.operationId) continue
    out.push(change)
  }
  return out
}
