import { Extension, type Editor } from '@tiptap/core'
import { Plugin, TextSelection, type PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorView } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import {
  blockSelectionPluginKey,
  DRAG_RANGE_STORAGE,
  KEEP_PLUGIN_SELECTION_META,
  autoScrollDelta,
  deleteRange,
  nestedConfig,
} from '../../editor/core'
import {
  blockSpans,
  moveBlockSelection,
  selectedRange,
  spanIndexAt,
  spansInRect,
  type BlockSelectionState,
  type BlockSpan,
} from './blockRange'
import { isLayoutResizePoint } from '../columns/behavior'
import { duplicateRange } from './operations'

const key = blockSelectionPluginKey as PluginKey<BlockSelectionState | null>

/** Spans of the blocks the selection ranges over: the top level, or the children of the selection's container. */
function spansFor(doc: PMNode, selection: BlockSelectionState | null | undefined): BlockSpan[] {
  if (selection?.scope === undefined) return blockSpans(doc)
  const container = doc.nodeAt(selection.scope)
  if (!container) return blockSpans(doc)
  const spans: BlockSpan[] = []
  container.forEach((child, offset) => {
    const pos = (selection.scope ?? 0) + 1 + offset
    spans.push({ pos, end: pos + child.nodeSize })
  })
  return spans
}

/** Scope (container position) and index of the block at `pos`, for selecting a block from its handle menu. */
function locate(editor: Editor, pos: number): { scope: number | undefined; index: number } | null {
  const doc = editor.state.doc
  if (pos < 0 || pos >= doc.content.size) return null
  const $pos = doc.resolve(pos)
  const scope = $pos.depth === 0 ? undefined : $pos.before($pos.depth)
  const probe = scope === undefined ? null : { anchor: 0, head: 0, scope }
  const index = spansFor(doc, probe).findIndex((span) => span.pos === pos)
  return index < 0 ? null : { scope, index }
}

/** Selects the one block at `pos` (handle menu: the touch route into block selection). */
export function selectBlockAt(editor: Editor, pos: number): boolean {
  const spot = locate(editor, pos)
  if (!spot) return false
  setSelection(editor.view, { anchor: spot.index, head: spot.index, scope: spot.scope })
  return true
}

/** Extends the current block selection to the block at `pos` (starts one when there is none or it is elsewhere). */
export function extendSelectionTo(editor: Editor, pos: number): boolean {
  const spot = locate(editor, pos)
  if (!spot) return false
  const current = key.getState(editor.state)
  const anchor = current && current.scope === spot.scope ? current.anchor : spot.index
  setSelection(editor.view, { anchor, head: spot.index, scope: spot.scope })
  return true
}

/** Deletes or duplicates the current block selection (handle menu equivalents of Backspace and Ctrl/Cmd+D). */
export function runOnSelection(editor: Editor, action: 'delete' | 'duplicate'): boolean {
  const selection = key.getState(editor.state)
  const range = selection ? selectedRange(spansFor(editor.state.doc, selection), selection) : null
  if (!selection || !range) return false
  setSelection(editor.view, null)
  if (action === 'delete') return deleteRange.run(editor, range.from, range.to)
  return duplicateRange.run(editor, range.from, range.to)
}

/** True while a block selection exists (handle menu entries for it only show then). */
export let blockSelectionActive = false

/** Innermost container (a column) around the caret whose children are plain blocks, or undefined at the top level. */
function scopeAround(editor: Editor): number | undefined {
  const { containers, owners } = nestedConfig(editor.storage)
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (!containers.includes(node.type.name) || owners.includes(node.type.name)) continue
    if (node.firstChild?.type.isInGroup('block')) return $from.before(depth)
  }
  return undefined
}

const INTERACTIVE = '.ProseMirror, .page-gutter, button, input, select, textarea, a, [role="menu"], .page-popover'

function setSelection(view: EditorView, value: BlockSelectionState | null) {
  view.dispatch(view.state.tr.setMeta(key, value))
}

function blockRects(view: EditorView) {
  const rects: DOMRect[] = []
  view.state.doc.forEach((_node, offset) => {
    const dom = view.nodeDOM(offset)
    rects.push(dom instanceof HTMLElement ? dom.getBoundingClientRect() : new DOMRect())
  })
  return rects
}

/** Index of the top-level block under a client point, or nearest by vertical distance among blocks at that x. */
function blockIndexAtPoint(view: EditorView, x: number, y: number): number {
  const rects = blockRects(view)
  const direct = rects.findIndex((rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
  if (direct >= 0) return direct
  let best = -1
  let bestDistance = Infinity
  rects.forEach((rect, index) => {
    if (x < rect.left || x > rect.right) return
    const distance = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

function attachMouse(view: EditorView): () => void {
  let marquee: HTMLElement | null = null
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target
    if (!(target instanceof Element) || event.button !== 0) return
    // Shift+click on a block's grip selects the blocks between the current block (or selection) and it.
    const handle = target.closest('.page-gutter__handle')
    if (handle && event.shiftKey) {
      const rect = handle.getBoundingClientRect()
      const index = blockIndexAtPoint(view, rect.left + rect.width / 2, rect.top + rect.height / 2)
      if (index < 0) return
      const current = key.getState(view.state)
      const anchor = current
        ? current.anchor
        : Math.max(0, spanIndexAt(blockSpans(view.state.doc), view.state.selection.from))
      event.stopPropagation()
      event.preventDefault()
      setSelection(view, { anchor, head: index })
      view.focus()
      return
    }
    // A divider drag resizes the columns or the grid. It must not also start a marquee — and
    // preventDefault here would swallow the mousedown the resize handler needs.
    if (isLayoutResizePoint(view, event.clientX, event.clientY)) return
    // Marquee: drag on the page background (outside text and controls) to select the blocks it touches.
    // The empty space of a column (or between columns, away from a divider) is page background too.
    const emptyLayoutSpace = target.matches('[data-type="column"], [data-type="column-list"]')
    if (!target.closest('.page-layout') || target.closest('.page-panel')) return
    if (!emptyLayoutSpace && target.closest(INTERACTIVE)) return
    // A drag from here is a marquee: stop the browser from also starting a native text selection (A4).
    event.preventDefault()
    // The start is kept in page coordinates so the rectangle keeps growing while the page auto-scrolls.
    // Started inside a column: the marquee selects that column's blocks instead of the top-level ones.
    const columnEl = target.closest('[data-type="column"]')
    let scope: number | undefined
    if (columnEl instanceof HTMLElement && view.dom.contains(columnEl)) {
      const inside = view.posAtDOM(columnEl, 0)
      const node = view.state.doc.nodeAt(inside - 1)
      if (node && node.childCount > 0 && node.firstChild?.type.isInGroup('block')) scope = inside - 1
    }
    const startX = event.clientX
    const startPageY = event.clientY + window.scrollY
    let pointerX = event.clientX
    let pointerY = event.clientY
    let frame = 0
    const update = () => {
      if (!marquee) return
      const startY = startPageY - window.scrollY
      const left = Math.min(startX, pointerX)
      const top = Math.min(startY, pointerY)
      const right = Math.max(startX, pointerX)
      const bottom = Math.max(startY, pointerY)
      const width = right - left
      const height = bottom - top
      Object.assign(marquee.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` })
      const rects =
        scope === undefined
          ? blockRects(view)
          : spansFor(view.state.doc, { anchor: 0, head: 0, scope }).map((span) => {
              const dom = view.nodeDOM(span.pos)
              return dom instanceof HTMLElement ? dom.getBoundingClientRect() : new DOMRect()
            })
      const hit = spansInRect(rects, { left, right, top, bottom })
      setSelection(view, hit ? { anchor: hit.first, head: hit.last, scope } : null)
    }
    const tick = () => {
      frame = 0
      const delta = autoScrollDelta(pointerY, window.innerHeight)
      if (delta !== 0) window.scrollBy(0, delta)
      update()
      if (marquee) frame = requestAnimationFrame(tick)
    }
    const onMove = (move: PointerEvent) => {
      pointerX = move.clientX
      pointerY = move.clientY
      const startY = startPageY - window.scrollY
      if (!marquee && Math.hypot(pointerX - startX, pointerY - startY) < 4) return
      if (!marquee) {
        marquee = document.createElement('div')
        marquee.className = 'page-marquee'
        document.body.appendChild(marquee)
        document.body.classList.add('page-is-marqueeing')
        frame = requestAnimationFrame(tick)
      }
      update()
    }
    const end = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('keydown', onKey)
      cancelAnimationFrame(frame)
      marquee?.remove()
      document.body.classList.remove('page-is-marqueeing')
      if (marquee) {
        // Collapse any stale text/node selection (e.g. the handle menu's NodeSelection) so
        // refocusing renders a caret inside the selected blocks, never a stray text range (A4).
        const selection = key.getState(view.state)
        const range = selection ? selectedRange(spansFor(view.state.doc, selection), selection) : null
        if (range) {
          const $from = view.state.doc.resolve(range.from + 1)
          view.dispatch(view.state.tr.setSelection(TextSelection.near($from)).setMeta(KEEP_PLUGIN_SELECTION_META, true))
        }
        view.focus()
      }
      marquee = null
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setSelection(view, null)
      end()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('keydown', onKey)
  }
  document.addEventListener('pointerdown', onPointerDown, true)
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true)
    marquee?.remove()
    document.body.classList.remove('page-is-marqueeing')
  }
}

function copySelection(view: EditorView, event: ClipboardEvent, cut: boolean, editor: Editor): boolean {
  const selection = key.getState(view.state)
  const range = selection ? selectedRange(spansFor(view.state.doc, selection), selection) : null
  if (!range || !event.clipboardData) return false
  const { dom, text } = view.serializeForClipboard(view.state.doc.slice(range.from, range.to))
  event.clipboardData.clearData()
  event.clipboardData.setData('text/html', dom.innerHTML)
  event.clipboardData.setData('text/plain', text)
  event.preventDefault()
  if (cut) {
    setSelection(view, null)
    deleteRange.run(editor, range.from, range.to)
  }
  return true
}

/**
 * Whole-block selection: Esc selects the block the caret is in, Shift+Up/Down extends,
 * arrows move, Backspace/Delete removes, Mod+D duplicates, copy/cut work on the blocks, Enter or Esc returns to
 * editing. With the mouse: drag on the page background (marquee) or Shift+click a block grip. Dragging a grip
 * inside the selection moves every selected block (through the core's drag-range storage hook).
 */
export const blockSelectionExtension = Extension.create({
  name: DRAG_RANGE_STORAGE,
  addStorage() {
    return {
      view: null as EditorView | null,
      resolve(this: { view: EditorView | null }, pos: number): { from: number; to: number } | null {
        const view = this.view
        if (!view) return null
        const selection = key.getState(view.state)
        const range = selection ? selectedRange(spansFor(view.state.doc, selection), selection) : null
        return range && pos >= range.from && pos < range.to ? range : null
      },
    }
  },
  addProseMirrorPlugins() {
    const editor = this.editor
    const storage = this.storage
    return [
      new Plugin<BlockSelectionState | null>({
        key,
        view: (view) => {
          storage.view = view
          const detach = attachMouse(view)
          return {
            destroy: () => {
              storage.view = null
              detach()
            },
          }
        },
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(key) as BlockSelectionState | null | undefined
            const keep = tr.getMeta(KEEP_PLUGIN_SELECTION_META) === true && !tr.docChanged
            const next =
              meta !== undefined ? meta : value && (tr.docChanged || (tr.selectionSet && !keep)) ? null : value
            blockSelectionActive = next !== null && next !== undefined
            return next
          },
        },
        props: {
          decorations(state) {
            const selection = key.getState(state)
            if (!selection) return null
            const spans = spansFor(state.doc, selection)
            const range = selectedRange(spans, selection)
            if (!range) return null
            const marks = spans
              .filter((span) => span.pos >= range.from && span.end <= range.to)
              .map((span) => Decoration.node(span.pos, span.end, { class: 'page-block-selected' }))
            return DecorationSet.create(state.doc, marks)
          },
          handleDOMEvents: {
            copy: (view, event) => copySelection(view, event as ClipboardEvent, false, editor),
            cut: (view, event) => copySelection(view, event as ClipboardEvent, true, editor),
            mousedown: (view, event) => {
              // Shift+click inside the text extends an existing block selection to the clicked block.
              const selection = key.getState(view.state)
              if (!selection || !event.shiftKey) return false
              const index = blockIndexAtPoint(view, event.clientX, event.clientY)
              if (index < 0) return false
              event.preventDefault()
              setSelection(view, { anchor: selection.anchor, head: index })
              return true
            },
          },
          handleKeyDown(view, event) {
            const selection = key.getState(view.state)
            const spans = spansFor(view.state.doc, selection)
            if (!selection) {
              if (event.key !== 'Escape' || event.defaultPrevented) return false
              if (document.querySelector('[role="menu"], .page-popover')) return false
              const scope = scopeAround(editor)
              const scoped = spansFor(view.state.doc, scope === undefined ? null : { anchor: 0, head: 0, scope })
              const index = spanIndexAt(scoped, view.state.selection.from)
              if (index < 0) return false
              setSelection(view, { anchor: index, head: index, scope })
              return true
            }
            const range = selectedRange(spans, selection)
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              setSelection(view, moveBlockSelection(selection, event.key, event.shiftKey, spans.length))
              return true
            }
            if (event.key === 'Escape' || event.key === 'Enter') {
              const target = spans[selection.head]
              setSelection(view, null)
              if (target && event.key === 'Enter') editor.commands.focus(target.end - 1)
              return true
            }
            if ((event.key === 'Backspace' || event.key === 'Delete') && range) {
              setSelection(view, null)
              deleteRange.run(editor, range.from, range.to)
              return true
            }
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd' && range) {
              event.preventDefault()
              duplicateRange.run(editor, range.from, range.to)
              const lowest = Math.min(selection.anchor, selection.head)
              const count = Math.abs(selection.head - selection.anchor) + 1
              setSelection(view, { anchor: lowest + count, head: lowest + 2 * count - 1, scope: selection.scope })
              return true
            }
            if (event.metaKey || event.ctrlKey || event.altKey) return false
            // Printable keys must not edit the text behind a block selection.
            return event.key.length === 1
          },
        },
      }),
    ]
  },
})
