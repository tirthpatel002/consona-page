import type { Editor, JSONContent } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import {
  KEEP_PLUGIN_SELECTION_META,
  blockSelectionPluginKey,
  deleteRange,
  moveBlocksTo,
} from '../../editor/core'
import { toDocx } from '../export/docx'
import { downloadBlob, openPrintWindow } from '../export/download'
import { prepareForExport } from '../export/host'
import { toHtml } from '../export/html'
import { toMarkdown } from '../export/markdown'
import { textOf, type Doc } from '../export/types'
import { extendSelectionTo, runOnSelection, selectBlockAt } from './blockSelection'
import { blockSpans, selectedRange, type BlockSelectionState, type BlockSpan } from './blockRange'

const key = blockSelectionPluginKey

function spansFor(editor: Editor, selection: BlockSelectionState): BlockSpan[] {
  if (selection.scope === undefined) return blockSpans(editor.state.doc)
  const container = editor.state.doc.nodeAt(selection.scope)
  if (!container) return blockSpans(editor.state.doc)
  const spans: BlockSpan[] = []
  container.forEach((child, offset) => {
    const pos = (selection.scope ?? 0) + 1 + offset
    spans.push({ pos, end: pos + child.nodeSize })
  })
  return spans
}

export function activeSelection(editor: Editor): {
  readonly selection: BlockSelectionState
  readonly spans: readonly BlockSpan[]
  readonly range: { readonly from: number; readonly to: number }
} | null {
  const selection = key.getState(editor.state) as BlockSelectionState | null
  if (!selection) return null
  const spans = spansFor(editor, selection)
  const range = selectedRange(spans, selection)
  return range ? { selection, spans, range } : null
}

/** JSON nodes for the selected blocks (top-level or scoped children). */
export function selectedBlocksJson(editor: Editor): JSONContent[] | null {
  const active = activeSelection(editor)
  if (!active) return null
  const nodes: JSONContent[] = []
  editor.state.doc.nodesBetween(active.range.from, active.range.to, (node, pos) => {
    if (pos < active.range.from) return true
    if (active.spans.some((span) => span.pos === pos)) {
      nodes.push(node.toJSON() as JSONContent)
      return false
    }
    return true
  })
  return nodes.length > 0 ? nodes : null
}

export type SelectionDownloadFormat = 'markdown' | 'text' | 'docx' | 'pdf'

/** Download the selected blocks in the chosen format (PDF opens the print dialog). */
export async function downloadSelected(
  editor: Editor,
  format: SelectionDownloadFormat = 'markdown',
): Promise<boolean> {
  const blocks = selectedBlocksJson(editor)
  if (!blocks) return false
  const doc = await prepareForExport({ type: 'doc', content: blocks } as Doc)
  if (format === 'markdown') {
    downloadBlob('selection.md', new Blob([toMarkdown(doc)], { type: 'text/markdown' }))
  } else if (format === 'text') {
    downloadBlob('selection.txt', new Blob([textOf(doc)], { type: 'text/plain' }))
  } else if (format === 'docx') {
    downloadBlob(
      'selection.docx',
      new Blob([toDocx(doc).buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    )
  } else {
    openPrintWindow(toHtml(doc, { title: 'selection' }))
  }
  return true
}

export async function copySelected(editor: Editor): Promise<boolean> {
  const active = activeSelection(editor)
  if (!active) return false
  const { dom, text } = editor.view.serializeForClipboard(editor.state.doc.slice(active.range.from, active.range.to))
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([dom.innerHTML], { type: 'text/html' }),
      }),
    ])
  } catch {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      window.prompt('Copy to clipboard: Ctrl/Cmd+C, then Enter', text)
    }
  }
  return true
}

function reselect(editor: Editor, startPos: number, count: number): void {
  selectBlockAt(editor, startPos)
  let pos = startPos
  for (let i = 1; i < count; i += 1) {
    const node = editor.state.doc.nodeAt(pos)
    if (!node) break
    pos += node.nodeSize
    extendSelectionTo(editor, pos)
  }
  // moveBlocksTo leaves a NodeSelection, which would open the text bubble. Collapse to a caret
  // inside the range while keeping the whole-block selection ring and bar.
  const restored = activeSelection(editor)
  if (!restored) return
  const $from = editor.state.doc.resolve(Math.min(restored.range.from + 1, restored.range.to - 1))
  editor.view.dispatch(
    editor.state.tr.setSelection(TextSelection.near($from)).setMeta(KEEP_PLUGIN_SELECTION_META, true),
  )
}

/** Move the selection one block up or down among siblings. */
export function moveSelected(editor: Editor, direction: -1 | 1): boolean {
  const active = activeSelection(editor)
  if (!active) return false
  const { selection, spans, range } = active
  const lo = Math.min(selection.anchor, selection.head)
  const hi = Math.max(selection.anchor, selection.head)
  const count = hi - lo + 1
  if (direction < 0) {
    if (lo <= 0) return false
    const before = spans[lo - 1]?.pos
    if (before === undefined) return false
    if (!moveBlocksTo.run(editor, range.from, range.to, before)) return false
  } else {
    if (hi >= spans.length - 1) return false
    const before = hi + 2 < spans.length ? (spans[hi + 2]?.pos ?? null) : null
    if (!moveBlocksTo.run(editor, range.from, range.to, before)) return false
  }
  const landed = editor.state.selection
  if (landed instanceof NodeSelection) reselect(editor, landed.from, count)
  return true
}

export function deleteSelected(editor: Editor): boolean {
  return runOnSelection(editor, 'delete')
}

export function duplicateSelected(editor: Editor): boolean {
  return runOnSelection(editor, 'duplicate')
}

/** Remove the current selection from the document after a successful move/create-page handoff. */
export function removeSelectedAfterHandoff(editor: Editor): boolean {
  const active = activeSelection(editor)
  if (!active) return false
  editor.view.dispatch(editor.state.tr.setMeta(key, null))
  return deleteRange.run(editor, active.range.from, active.range.to)
}
