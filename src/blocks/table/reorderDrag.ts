import { slotForPointer, targetIndexForSlot, type ReorderAxis } from './reorder'

export const REORDER_LAYER_ATTR = 'data-table-reorder-layer'
const THRESHOLD_PX = 4
const EDGE_PX = 48
const MAX_SPEED = 18

export interface DragRequest {
  readonly axis: ReorderAxis
  /** The table's `.native-table` element. */
  readonly root: HTMLElement
  readonly from: number
  /** Lowest slot a drop may use (rows: below the header rows). */
  readonly minSlot: number
  readonly pointerId: number
  readonly startX: number
  readonly startY: number
  readonly onDrop: (from: number, to: number) => void
  /** A press that never became a drag (select the column / row). */
  readonly onClick: () => void
}

/** The nearest ancestor that scrolls vertically, or null for the page. */
function verticalScroller(from: HTMLElement): HTMLElement | null {
  for (let node = from.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
  }
  return null
}

const rate = (distanceInside: number) => Math.round(MAX_SPEED * Math.min(1, Math.max(0, distanceInside / EDGE_PX)))

/**
 * Pointer drag of one column or row. Mouse, touch and pen share pointer events. While dragging it shows
 * a ghost of the picked-up item and an insertion line (both in the table's non-editable layer, so the
 * document is untouched until the drop), and scrolls the table sideways / the page up or down when the
 * pointer nears an edge. Escape or a cancelled pointer aborts with no change.
 */
export function startReorderDrag(request: DragRequest): void {
  const { axis, root, from, minSlot } = request
  const scroll = root.querySelector<HTMLElement>('.native-table__scroll')
  const layer = root.querySelector<HTMLElement>(`[${REORDER_LAYER_ATTR}]`)
  const table = root.querySelector<HTMLTableElement>('table')
  if (!scroll || !layer || !table) return

  let x = request.startX
  let y = request.startY
  let dragging = false
  let raf = 0
  let ghost: HTMLElement | null = null
  let line: HTMLElement | null = null
  let slot = from
  const pageScroller = verticalScroller(root)

  const items = (): HTMLElement[] =>
    axis === 'column' ? Array.from(table.rows[0]?.cells ?? []) : Array.from(table.rows)
  /** Rect of an item relative to the scroll content (layer coordinates). */
  const local = (el: HTMLElement) => {
    const box = el.getBoundingClientRect()
    const origin = scroll.getBoundingClientRect()
    return {
      left: box.left - origin.left + scroll.scrollLeft,
      top: box.top - origin.top + scroll.scrollTop,
      width: box.width,
      height: box.height,
    }
  }

  const place = () => {
    const els = items()
    const rects = els.map(local)
    const origin = scroll.getBoundingClientRect()
    const pointer = axis === 'column' ? x - origin.left + scroll.scrollLeft : y - origin.top + scroll.scrollTop
    const centers = rects.map((r) => (axis === 'column' ? r.left + r.width / 2 : r.top + r.height / 2))
    slot = slotForPointer(centers, pointer, minSlot)
    const picked = rects[from]
    const tableRect = local(table)
    if (picked && ghost) {
      const size = axis === 'column' ? picked.width : picked.height
      const lead = pointer - size / 2
      ghost.style.left = axis === 'column' ? `${lead}px` : `${tableRect.left}px`
      ghost.style.top = axis === 'column' ? `${tableRect.top}px` : `${lead}px`
      ghost.style.width = axis === 'column' ? `${size}px` : `${tableRect.width}px`
      ghost.style.height = axis === 'column' ? `${tableRect.height}px` : `${size}px`
    }
    const edge = (index: number) => {
      const r = rects[Math.min(index, rects.length - 1)]
      if (!r) return 0
      if (axis === 'column') return index >= rects.length ? r.left + r.width : r.left
      return index >= rects.length ? r.top + r.height : r.top
    }
    const noop = targetIndexForSlot(from, slot) === from
    if (line) {
      line.hidden = noop
      line.style.left = axis === 'column' ? `${edge(slot) - 1}px` : `${tableRect.left}px`
      line.style.top = axis === 'column' ? `${tableRect.top}px` : `${edge(slot) - 1}px`
      line.style.width = axis === 'column' ? '2px' : `${tableRect.width}px`
      line.style.height = axis === 'column' ? `${tableRect.height}px` : '2px'
    }
  }

  const autoscroll = () => {
    raf = 0
    if (!dragging) return
    const box = scroll.getBoundingClientRect()
    {
      const left = rate(EDGE_PX - (x - box.left))
      const right = rate(EDGE_PX - (box.right - x))
      if (left || right) scroll.scrollLeft += right - left
    }
    if (axis === 'row') {
      const view = pageScroller?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight }
      const up = rate(EDGE_PX - (y - Math.max(0, view.top)))
      const down = rate(EDGE_PX - (Math.min(window.innerHeight, view.bottom) - y))
      if (up || down) {
        if (pageScroller) pageScroller.scrollTop += down - up
        else window.scrollBy(0, down - up)
      }
    }
    place()
    raf = requestAnimationFrame(autoscroll)
  }

  const finish = () => {
    window.removeEventListener('pointermove', onMove, true)
    window.removeEventListener('pointerup', onUp, true)
    window.removeEventListener('pointercancel', onCancel, true)
    window.removeEventListener('keydown', onKey, true)
    if (raf) cancelAnimationFrame(raf)
    ghost?.remove()
    line?.remove()
    root.classList.remove('is-reordering')
    delete root.dataset.reordering
  }

  const begin = () => {
    dragging = true
    root.classList.add('is-reordering')
    root.dataset.reordering = axis
    ghost = document.createElement('div')
    ghost.className = 'native-table__reorder-ghost'
    line = document.createElement('div')
    line.className = 'native-table__reorder-line'
    layer.append(ghost, line)
    place()
    raf = requestAnimationFrame(autoscroll)
  }

  function onMove(event: PointerEvent) {
    if (event.pointerId !== request.pointerId) return
    x = event.clientX
    y = event.clientY
    if (!dragging) {
      if (Math.hypot(x - request.startX, y - request.startY) < THRESHOLD_PX) return
      begin()
    }
    event.preventDefault()
    place()
  }
  function onUp(event: PointerEvent) {
    if (event.pointerId !== request.pointerId) return
    const wasDragging = dragging
    const to = targetIndexForSlot(from, slot)
    finish()
    if (!wasDragging) request.onClick()
    else if (to !== from) request.onDrop(from, to)
  }
  function onCancel(event: PointerEvent) {
    if (event.pointerId === request.pointerId) finish()
  }
  function onKey(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    finish()
  }

  window.addEventListener('pointermove', onMove, true)
  window.addEventListener('pointerup', onUp, true)
  window.addEventListener('pointercancel', onCancel, true)
  window.addEventListener('keydown', onKey, true)
}
