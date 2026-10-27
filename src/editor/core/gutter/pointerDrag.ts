import type { Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'
import { moveBlocksTo } from '../operations/operations'
import { autoScrollDelta, dropSlot, isNoopMove, slotY } from './dropTarget'

const THRESHOLD = 4

/** Name of the optional editor-storage entry a plugin can fill to drag several blocks together. */
export const DRAG_RANGE_STORAGE = 'pageBlockDragRange'

/** Name of the optional editor-storage entry a plugin can fill to turn a pointer position into a custom drop target. */
export const DROP_TARGET_STORAGE = 'pageBlockDropTarget'

export interface DropProposal {
  /** Client-space rectangle of the drop indicator (a thin line). */
  readonly rect: { left: number; top: number; width: number; height: number }
  /** Applies the drop as one undoable operation. */
  readonly commit: () => void
}

export interface DropTargetStorage {
  /** A custom drop for a pointer at (x, y) while dragging `[from, to)`, or null to use the default top-level slots. */
  resolve: (context: { x: number; y: number; from: number; to: number }) => DropProposal | null
}

export interface DragRangeStorage {
  /** The document range to move when the block at `pos` is dragged (e.g. a whole block selection), or null. */
  resolve: (pos: number) => { from: number; to: number } | null
}

function dragRangeOf(editor: Editor, pos: number): { from: number; to: number } {
  const storage = (editor.storage as unknown as Record<string, DragRangeStorage | undefined>)[DRAG_RANGE_STORAGE]
  const range = storage?.resolve(pos)
  if (range) return range
  const node = editor.state.doc.nodeAt(pos)
  return { from: pos, to: pos + (node?.nodeSize ?? 0) }
}

interface Block {
  readonly pos: number
  readonly dom: HTMLElement
}

function topLevelBlocks(view: EditorView): Block[] {
  const blocks: Block[] = []
  view.state.doc.forEach((_node, offset) => {
    const dom = view.nodeDOM(offset)
    if (dom instanceof HTMLElement) blocks.push({ pos: offset, dom })
  })
  return blocks
}

export interface PointerDragHooks {
  /** Called once the pointer has moved far enough to count as a drag (not a click). */
  readonly onDragStart: () => void
  /** Called on release; `dragged` is false for a plain click. */
  readonly onEnd: (dragged: boolean) => void
}

/**
 * Pointer-based drag of the top-level block at `pos`: a drop line shows where it will land, the page
 * scrolls near the viewport edges, and release moves it with one undoable operation. A press that never
 * moves is reported as a click.
 */
export function startPointerDrag(
  editor: Editor,
  container: HTMLElement,
  pos: number,
  down: PointerEvent,
  hooks: PointerDragHooks,
): void {
  const view = editor.view
  const handle = down.currentTarget as HTMLElement | null
  handle?.setPointerCapture?.(down.pointerId)
  const startX = down.clientX
  const startY = down.clientY
  let dragged = false
  let pointerX = startX
  let pointerY = startY
  let proposal: DropProposal | null = null
  let frame = 0
  let slot = -1
  const indicator = document.createElement('div')
  indicator.className = 'page-drop-indicator'
  indicator.setAttribute('aria-hidden', 'true')
  const source = view.nodeDOM(pos)

  const place = () => {
    const range = dragRangeOf(editor, pos)
    proposal = null
    // Every plugin storage named like DROP_TARGET_STORAGE may offer a drop; the first proposal wins.
    for (const [name, custom] of Object.entries(editor.storage as unknown as Record<string, DropTargetStorage>)) {
      if (!name.startsWith(DROP_TARGET_STORAGE)) continue
      proposal = custom.resolve({ x: pointerX, y: pointerY, from: range.from, to: range.to })
      if (proposal) break
    }
    const frame0 = container.getBoundingClientRect()
    if (proposal) {
      const r = proposal.rect
      indicator.style.display = 'block'
      indicator.style.top = `${r.top - frame0.top}px`
      indicator.style.left = `${r.left - frame0.left}px`
      indicator.style.width = `${r.width}px`
      indicator.style.height = `${r.height}px`
      indicator.style.marginTop = r.height > 3 ? '0' : ''
      return
    }
    indicator.style.height = ''
    indicator.style.marginTop = ''
    const blocks = topLevelBlocks(view)
    const rects = blocks.map((block) => block.dom.getBoundingClientRect())
    slot = dropSlot(rects, pointerY)
    const from = blocks.findIndex((block) => block.pos === pos)
    const y = isNoopMove(from, slot) ? null : slotY(rects, slot)
    const box = container.getBoundingClientRect()
    const first = rects[0]
    indicator.style.display = y === null ? 'none' : 'block'
    if (y !== null) {
      indicator.style.top = `${y - box.top}px`
      indicator.style.left = `${(first?.left ?? box.left) - box.left}px`
      indicator.style.width = `${first?.width ?? box.width}px`
    }
  }

  const tick = () => {
    frame = 0
    const delta = autoScrollDelta(pointerY, window.innerHeight)
    if (delta !== 0) window.scrollBy(0, delta)
    place()
    if (dragged) frame = requestAnimationFrame(tick)
  }

  const onMove = (event: PointerEvent) => {
    pointerX = event.clientX
    pointerY = event.clientY
    if (!dragged && Math.hypot(event.clientX - startX, event.clientY - startY) < THRESHOLD) return
    if (!dragged) {
      dragged = true
      hooks.onDragStart()
      container.appendChild(indicator)
      if (source instanceof HTMLElement) source.classList.add('page-dragging')
      document.body.classList.add('page-is-dragging')
      frame = requestAnimationFrame(tick)
    }
    event.preventDefault()
  }

  const finish = (commit: boolean) => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey)
    cancelAnimationFrame(frame)
    indicator.remove()
    if (source instanceof HTMLElement) source.classList.remove('page-dragging')
    document.body.classList.remove('page-is-dragging')
    if (dragged && commit && proposal) {
      proposal.commit()
    } else if (dragged && commit && slot >= 0) {
      const blocks = topLevelBlocks(view)
      const range = dragRangeOf(editor, pos)
      moveBlocksTo.run(editor, range.from, range.to, blocks[slot]?.pos ?? null)
    }
    hooks.onEnd(dragged)
  }
  const onUp = () => finish(true)
  const onCancel = () => finish(false)
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') finish(false)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey)
}
