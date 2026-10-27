import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { CellSelection, findTable, TableMap } from '@tiptap/pm/tables'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { columnReorderBlocker, reorderTransaction, rowReorderBlocker, type ReorderAxis } from './reorder'
import { startReorderDrag } from './reorderDrag'
import { leadingHeaderRows } from './tableQueries'

export const reorderHandlesKey = new PluginKey<DecorationSet>('tableReorderHandles')
export const REORDER_HANDLE_ATTR = 'data-table-reorder-handle'

const LABEL: Record<ReorderAxis, string> = { column: 'Drag to move column', row: 'Drag to move row' }

function handleWidget(axis: ReorderAxis, index: number, at: number) {
  return Decoration.widget(
    at,
    (view: EditorView, getPos) => {
      /** The table is looked up when used: a reused widget must not remember a stale position. */
      const tableAt = () => {
        const pos = getPos()
        const found = pos === undefined ? null : findTable(view.state.doc.resolve(pos))
        return found ? { pos: found.pos, header: leadingHeaderRows(found.node) } : null
      }
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `native-table__reorder native-table__reorder--${axis}`
      button.contentEditable = 'false'
      button.tabIndex = -1
      button.setAttribute(REORDER_HANDLE_ATTR, axis)
      button.setAttribute('aria-label', `${LABEL[axis]} ${index + 1}. Arrow keys also move it.`)
      button.title = LABEL[axis]
      button.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || !view.editable) return
        event.preventDefault()
        event.stopPropagation()
        const found = tableAt()
        const root = found ? view.nodeDOM(found.pos) : null
        if (!found || !(root instanceof HTMLElement)) return
        select(view, found.pos, axis, index)
        startReorderDrag({
          axis,
          root,
          from: index,
          minSlot: axis === 'row' ? found.header : 0,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          onDrop: (from, to) => {
            const now = tableAt()
            const tr = now ? reorderTransaction(view.state, now.pos, axis, from, to, { kind: 'cells' }) : null
            if (tr) view.dispatch(tr)
            view.focus()
          },
          onClick: () => view.focus(),
        })
      })
      button.addEventListener('keydown', (event) => {
        const delta = arrowDelta(axis, event.key)
        if (delta === 0 || !view.editable) return
        event.preventDefault()
        const found = tableAt()
        const tr = found
          ? reorderTransaction(view.state, found.pos, axis, index, index + delta, { kind: 'cells' })
          : null
        if (!found || !tr) return
        view.dispatch(tr)
        // The widgets are rebuilt after the move: keep keyboard focus on the moved item's handle.
        queueMicrotask(() => {
          const root = view.nodeDOM(found.pos)
          if (!(root instanceof HTMLElement)) return
          root
            .querySelectorAll<HTMLElement>(`[${REORDER_HANDLE_ATTR}="${axis}"]`)
            [index + delta - (axis === 'row' ? found.header : 0)]?.focus()
        })
      })
      return button
    },
    { side: -1, ignoreSelection: true, stopEvent: () => true, key: `reorder-${axis}-${index}` },
  )
}

function arrowDelta(axis: ReorderAxis, key: string): number {
  if (axis === 'column') return key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0
  return key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0
}

/** A press on a handle selects the whole column / row (as cells), like a click. */
function select(view: EditorView, tablePos: number, axis: ReorderAxis, index: number): void {
  const table = view.state.doc.nodeAt(tablePos)
  if (!table) return
  const map = TableMap.get(table)
  const start = tablePos + 1
  const at = (row: number, column: number) => view.state.doc.resolve(start + map.positionAt(row, column, table))
  const selection =
    axis === 'column'
      ? CellSelection.colSelection(at(map.height - 1, index), at(0, index))
      : CellSelection.rowSelection(at(index, map.width - 1), at(index, 0))
  view.dispatch(view.state.tr.setSelection(selection))
}

function build(state: EditorState): DecorationSet {
  const decorations: Decoration[] = []
  state.doc.descendants((node: PMNode, pos: number) => {
    if (node.type.spec.tableRole !== 'table') return true
    const map = TableMap.get(node)
    const headerCount = leadingHeaderRows(node)
    if (columnReorderBlocker(node) === null) {
      for (let col = 0; col < map.width; col += 1) {
        const offset = map.map[col]
        if (offset !== undefined) decorations.push(handleWidget('column', col, pos + 1 + offset + 1))
      }
    }
    if (rowReorderBlocker(node) === null) {
      for (let row = headerCount; row < map.height; row += 1) {
        const offset = map.map[row * map.width]
        if (offset !== undefined) decorations.push(handleWidget('row', row, pos + 1 + offset + 1))
      }
    }
    return false
  })
  return DecorationSet.create(state.doc, decorations)
}

/** Thin edge handles on the first row's cells (move column) and on each body row's first cell (move row). */
export const reorderHandlesPlugin = () =>
  new Plugin<DecorationSet>({
    key: reorderHandlesKey,
    state: {
      init: (_config, state) => build(state),
      apply: (tr, previous, _old, state) => (tr.docChanged ? build(state) : previous),
    },
    props: { decorations: (state) => reorderHandlesKey.getState(state) },
  })
