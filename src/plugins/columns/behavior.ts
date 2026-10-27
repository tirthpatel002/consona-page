import { Extension, type Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import {
  BLOCK_REMOVAL_META,
  DROP_TARGET_STORAGE,
  NESTED_BLOCKS_STORAGE,
  blockEntries,
  moveBlocksTo,
  type DropProposal,
} from '../../editor/core'
import { dropBeside, planDropBeside, setColumnWidths, setGridTracks, type DropSide } from './operations'
import { MAX_GRID_TRACKS, MIN_GRID_TRACKS } from './extensions'

const CONTAINERS = ['columnList', 'column'] as const

/** Declares column lists and columns as containers whose blocks get their own handles and drop targets. */
export const NestedBlocks = Extension.create({
  name: NESTED_BLOCKS_STORAGE,
  addStorage() {
    return { containers: [...CONTAINERS] }
  },
})

const isFiller = (column: PMNode) =>
  column.childCount === 1 && column.child(0).type.name === 'paragraph' && column.child(0).content.size === 0

/**
 * Keeps layouts valid after any change: a column emptied by moving or deleting its blocks is removed (the list
 * becomes plain blocks when only one column would be left), and column lists never nest.
 */
export function tidyColumns(transactions: readonly Transaction[], state: EditorState): Transaction | null {
  if (!transactions.some((t) => t.docChanged)) return null
  const tr = state.tr
  const emptied: number[] = []
  transactions.forEach((t, index) => {
    const removal = t.getMeta(BLOCK_REMOVAL_META) as { from: number; to: number } | undefined
    if (!removal) return
    const $from = t.before.resolve(removal.from)
    if ($from.parent.type.name !== 'column') return
    if (removal.from !== $from.start() || removal.to !== $from.end()) return
    let pos = $from.before()
    for (let i = index; i < transactions.length; i++) pos = transactions[i]?.mapping.map(pos, -1) ?? pos
    emptied.push(pos)
  })
  emptied
    .sort((a, b) => b - a)
    .forEach((original) => {
      const pos = tr.mapping.map(original, -1)
      const column = tr.doc.nodeAt(pos)
      if (column?.type.name !== 'column' || !isFiller(column)) return
      const $pos = tr.doc.resolve(pos)
      const list = $pos.parent
      if (list.type.name !== 'columnList') return
      if (list.childCount > 2) {
        tr.delete(pos, pos + column.nodeSize)
        return
      }
      const listStart = $pos.before()
      const keep: PMNode[] = []
      list.forEach((other) => {
        if (other !== column) other.forEach((child) => keep.push(child))
      })
      tr.replaceWith(listStart, listStart + list.nodeSize, keep)
    })
  const nested: { pos: number; node: PMNode }[] = []
  tr.doc.descendants((node, pos) => {
    if (node.type.name === 'columnList' && tr.doc.resolve(pos).parent.type.name === 'column') nested.push({ pos, node })
    return true
  })
  nested
    .sort((a, b) => b.pos - a.pos)
    .forEach(({ pos, node }) => {
      const blocks: PMNode[] = []
      node.forEach((column) => column.forEach((child) => blocks.push(child)))
      tr.replaceWith(tr.mapping.map(pos), tr.mapping.map(pos + node.nodeSize), blocks)
    })
  return tr.docChanged ? tr : null
}

const EDGE = 56

interface DropStorage {
  view: EditorView | null
  editor: Editor | null
  resolve: (context: { x: number; y: number; from: number; to: number }) => DropProposal | null
}

/**
 * Drop targets for the core drag: the left/right edge of a block makes (or adds to) columns, and the middle of a
 * block inside a column places the dragged blocks above or below it. Anywhere else the core's top-level slots apply.
 */
export const ColumnDrop = Extension.create<unknown, DropStorage>({
  name: DROP_TARGET_STORAGE,
  addStorage() {
    return {
      view: null,
      editor: null,
      resolve(this: DropStorage, { x, y, from, to }) {
        const { view, editor } = this
        if (!view || !editor) return null
        const entries = blockEntries(view, CONTAINERS).filter((e) => !(e.pos >= from && e.pos < to))
        const hits = entries
          .map((entry) => ({ entry, rect: entry.dom.getBoundingClientRect() }))
          .filter(({ rect }) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
          .sort((a, b) => b.entry.depth - a.entry.depth)
        const hit = hits[0]
        if (!hit) return null
        const { entry, rect } = hit
        const side: DropSide | null =
          x - rect.left < Math.min(EDGE, rect.width * 0.25)
            ? 'left'
            : rect.right - x < Math.min(EDGE, rect.width * 0.25)
              ? 'right'
              : null
        const doc = view.state.doc
        if (side) {
          if (!planDropBeside(doc, from, to, entry.pos, side)) return null
          const $pos = doc.resolve(entry.pos)
          const columnDom = $pos.parent.type.name === 'column' ? view.nodeDOM($pos.before($pos.depth)) : null
          const box = columnDom instanceof HTMLElement ? columnDom.getBoundingClientRect() : rect
          return {
            rect: { left: side === 'left' ? box.left - 4 : box.right + 1, top: box.top, width: 3, height: box.height },
            commit: () => void dropBeside.run(editor, from, to, entry.pos, side),
          }
        }
        if (entry.depth === 0) return null
        const before = y < (rect.top + rect.bottom) / 2
        const at = before ? entry.pos : entry.pos + entry.node.nodeSize
        if (at >= from && at <= to) return null
        return {
          rect: { left: rect.left, top: before ? rect.top - 2 : rect.bottom + 1, width: rect.width, height: 3 },
          commit: () => void moveBlocksTo.run(editor, from, to, at),
        }
      },
    }
  },
  addProseMirrorPlugins() {
    const storage = this.storage
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('pageColumnDrop'),
        view(view) {
          storage.view = view
          storage.editor = editor
          return {
            destroy() {
              storage.view = null
            },
          }
        },
      }),
    ]
  },
})

const MIN_COLUMN_PX = 96
/** Extra pixels past each column edge so the border itself, not only the gap, starts a resize. */
const EDGE_SLACK = 6

interface ColumnEdge {
  readonly list: HTMLElement
  readonly cells: HTMLElement[]
  readonly index: number
  readonly box: DOMRect
  readonly x: number
  readonly a: DOMRect
  readonly b: DOMRect
}

/** True when x sits in the gap between two side-by-side boxes, including a small bite of each edge. */
export function isHorizontalGap(x: number, aRight: number, bLeft: number, slack = EDGE_SLACK): boolean {
  if (bLeft < aRight - 1) return false
  return x >= aRight - slack && x <= bLeft + slack
}

function horizontalEdges(view: EditorView, x: number, y: number, layout: 'columns' | 'grid'): ColumnEdge[] {
  const found: ColumnEdge[] = []
  for (const list of view.dom.querySelectorAll<HTMLElement>(`.page-columns[data-layout="${layout}"]`)) {
    const box = list.getBoundingClientRect()
    if (y < box.top || y > box.bottom) continue
    const cells = [...list.children].filter((cell): cell is HTMLElement => cell instanceof HTMLElement)
    for (let i = 0; i < cells.length - 1; i++) {
      const a = cells[i]?.getBoundingClientRect()
      const b = cells[i + 1]?.getBoundingClientRect()
      if (!a || !b || Math.abs(a.top - b.top) > 2) continue
      if (y < a.top || y > a.bottom) continue
      if (!isHorizontalGap(x, a.right, b.left)) continue
      found.push({ list, cells, index: i, box, x: (a.right + b.left) / 2, a, b })
    }
  }
  return found
}

/** Pointer is on a column or grid divider, which must resize instead of starting a block selection. */
export function isLayoutResizePoint(view: EditorView, x: number, y: number): boolean {
  return horizontalEdges(view, x, y, 'columns').length > 0 || horizontalEdges(view, x, y, 'grid').length > 0
}

/** Direct DOM edits during a drag must not be reconciled back to the old document until release. */
function pauseDomObserver(view: EditorView): { resume: () => void } {
  const observer = (view as EditorView & { domObserver?: { stop: () => void; start: () => void } }).domObserver
  observer?.stop()
  return {
    resume: () => observer?.start(),
  }
}

/** Hover guide and drag handle on the edge shared by two columns; release stores the new widths as one step. */
export const ColumnResize = Extension.create({
  name: 'pageColumnResize',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('pageColumnResize'),
        view(view) {
          const guide = document.createElement('div')
          guide.className = 'page-column-guide'
          guide.setAttribute('aria-hidden', 'true')
          guide.style.display = 'none'
          document.body.appendChild(guide)
          let drag: {
            list: HTMLElement
            columns: HTMLElement[]
            index: number
            startX: number
            widths: number[]
          } | null = null

          const edgeAt = (x: number, y: number) => {
            const edge = horizontalEdges(view, x, y, 'columns')[0]
            if (!edge) return null
            return { list: edge.list, columns: edge.cells, index: edge.index, box: edge.box, x: edge.x }
          }
          const showGuide = (box: DOMRect, x: number) => {
            guide.style.display = 'block'
            guide.style.left = `${x - 1}px`
            guide.style.top = `${box.top}px`
            guide.style.height = `${box.height}px`
          }
          const onHover = (event: MouseEvent) => {
            if (drag) return
            const edge = edgeAt(event.clientX, event.clientY)
            view.dom.style.cursor = edge ? 'col-resize' : ''
            if (edge) showGuide(edge.box, edge.x)
            else guide.style.display = 'none'
          }
          let resumeObserver = () => {}
          const onDown = (event: PointerEvent) => {
            if (event.button !== 0) return
            const edge = edgeAt(event.clientX, event.clientY)
            if (!edge) return
            event.preventDefault()
            event.stopPropagation()
            resumeObserver = pauseDomObserver(view).resume
            drag = {
              list: edge.list,
              columns: edge.columns,
              index: edge.index,
              startX: event.clientX,
              widths: edge.columns.map((c) => c.getBoundingClientRect().width),
            }
            apply(event.clientX)
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
            window.addEventListener('pointercancel', onUp)
          }
          const apply = (clientX: number) => {
            if (!drag) return null
            const { widths, index, columns } = drag
            const a = widths[index] ?? 0
            const b = widths[index + 1] ?? 0
            const delta = Math.max(MIN_COLUMN_PX - a, Math.min(b - MIN_COLUMN_PX, clientX - drag.startX))
            const next = widths.map((w, i) => (i === index ? a + delta : i === index + 1 ? b - delta : w))
            columns.forEach((c, i) => {
              c.style.flex = `0 0 ${next[i]}px`
            })
            return next
          }
          const onMove = (event: PointerEvent) => {
            const next = apply(event.clientX)
            if (!next || !drag) return
            const box = drag.list.getBoundingClientRect()
            const col = drag.columns[drag.index]?.getBoundingClientRect()
            const following = drag.columns[drag.index + 1]?.getBoundingClientRect()
            if (col && following) showGuide(box, (col.right + following.left) / 2)
          }
          const onUp = (event: PointerEvent) => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            window.removeEventListener('pointercancel', onUp)
            const current = drag
            const next = apply(event.clientX)
            drag = null
            guide.style.display = 'none'
            view.dom.style.cursor = ''
            current?.columns.forEach((c) => (c.style.flex = ''))
            resumeObserver()
            resumeObserver = () => {}
            if (!current || !next) return
            const total = next.reduce((sum, w) => sum + w, 0)
            const weights = next.map((w) => Math.round((w / total) * next.length * 1000) / 1000)
            const pos = view.posAtDOM(current.list, 0) - 1
            setColumnWidths.run(editor, pos, weights)
          }
          view.dom.addEventListener('mousemove', onHover)
          view.dom.addEventListener('pointerdown', onDown, true)
          view.dom.addEventListener('mouseleave', () => {
            if (!drag) guide.style.display = 'none'
          })
          return {
            destroy() {
              view.dom.removeEventListener('mousemove', onHover)
              view.dom.removeEventListener('pointerdown', onDown, true)
              window.removeEventListener('pointermove', onMove)
              window.removeEventListener('pointerup', onUp)
              window.removeEventListener('pointercancel', onUp)
              resumeObserver()
              guide.remove()
            },
          }
        },
      }),
    ]
  },
})

/** Plugin wrapper: runs the tidy step after every transaction. */
export const ColumnTidy = Extension.create({
  name: 'pageColumnTidy',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('pageColumnTidy'),
        appendTransaction: (transactions, _old, state) => tidyColumns(transactions, state),
      }),
    ]
  },
})

/** Per-row cell count a grid would get if its cells were `cellWidth` wide. */
export function tracksForCellWidth(listWidth: number, cellWidth: number): number {
  if (cellWidth <= 0) return MAX_GRID_TRACKS
  return Math.max(MIN_GRID_TRACKS, Math.min(MAX_GRID_TRACKS, Math.round(listWidth / cellWidth)))
}

/**
 * Drag the edge between two grid cells sideways to change how many cells fit per row (wider cells, fewer per row).
 * A guide and a label follow the pointer; release stores the count as one undo step.
 */
export const GridResize = Extension.create({
  name: 'pageGridResize',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('pageGridResize'),
        view(view) {
          const guide = document.createElement('div')
          guide.className = 'page-column-guide page-grid-guide'
          guide.setAttribute('aria-hidden', 'true')
          guide.style.display = 'none'
          document.body.appendChild(guide)
          let resumeObserver = () => {}
          let drag: { list: HTMLElement; startX: number; cellWidth: number; listWidth: number; tracks: number } | null =
            null

          const edgeAt = (x: number, y: number) => {
            const edge = horizontalEdges(view, x, y, 'grid')[0]
            if (!edge) return null
            return {
              list: edge.list,
              box: edge.box,
              x: edge.x,
              cellWidth: edge.a.width,
              rowTop: edge.a.top,
              rowHeight: edge.a.height,
            }
          }
          const show = (top: number, height: number, x: number, label?: string) => {
            guide.style.display = 'block'
            guide.style.left = `${x - 1}px`
            guide.style.top = `${top}px`
            guide.style.height = `${height}px`
            guide.dataset.label = label ?? ''
          }
          const onHover = (event: MouseEvent) => {
            if (drag) return
            const edge = edgeAt(event.clientX, event.clientY)
            view.dom.style.cursor = edge ? 'col-resize' : ''
            if (edge) show(edge.rowTop, edge.rowHeight, edge.x)
            else guide.style.display = 'none'
          }
          const countAt = (clientX: number) => {
            if (!drag) return 0
            return tracksForCellWidth(drag.listWidth, drag.cellWidth + (clientX - drag.startX))
          }
          const paintTracks = (tracks: number) => {
            if (!drag) return
            drag.list.style.gridTemplateColumns = `repeat(${tracks}, minmax(0, 1fr))`
          }
          const onDown = (event: PointerEvent) => {
            if (event.button !== 0) return
            const edge = edgeAt(event.clientX, event.clientY)
            if (!edge) return
            event.preventDefault()
            event.stopPropagation()
            resumeObserver = pauseDomObserver(view).resume
            drag = {
              list: edge.list,
              startX: event.clientX,
              cellWidth: edge.cellWidth,
              listWidth: edge.box.width,
              tracks: 0,
            }
            drag.tracks = countAt(event.clientX)
            paintTracks(drag.tracks)
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
            window.addEventListener('pointercancel', onUp)
          }
          const onMove = (event: PointerEvent) => {
            if (!drag) return
            drag.tracks = countAt(event.clientX)
            paintTracks(drag.tracks)
            const box = drag.list.getBoundingClientRect()
            show(box.top, Math.min(box.height, 48), event.clientX, `${drag.tracks} per row`)
          }
          const onUp = (event: PointerEvent) => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            window.removeEventListener('pointercancel', onUp)
            const current = drag
            drag = null
            guide.style.display = 'none'
            view.dom.style.cursor = ''
            if (current) current.list.style.gridTemplateColumns = ''
            resumeObserver()
            resumeObserver = () => {}
            if (!current) return
            const tracks = tracksForCellWidth(current.listWidth, current.cellWidth + (event.clientX - current.startX))
            const pos = view.posAtDOM(current.list, 0) - 1
            setGridTracks.run(editor, pos, tracks)
          }
          view.dom.addEventListener('mousemove', onHover)
          view.dom.addEventListener('pointerdown', onDown, true)
          view.dom.addEventListener('mouseleave', () => {
            if (!drag) guide.style.display = 'none'
          })
          return {
            destroy() {
              view.dom.removeEventListener('mousemove', onHover)
              view.dom.removeEventListener('pointerdown', onDown, true)
              window.removeEventListener('pointermove', onMove)
              window.removeEventListener('pointerup', onUp)
              window.removeEventListener('pointercancel', onUp)
              resumeObserver()
              guide.remove()
            },
          }
        },
      }),
    ]
  },
})
