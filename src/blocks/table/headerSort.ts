import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, Selection, type EditorState } from '@tiptap/pm/state'
import { isInTable, selectedRect, TableMap } from '@tiptap/pm/tables'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { chevronDownSvg } from './icons'
import { leadingHeaderRows } from './tableQueries'

/** Transaction meta set when a header chevron is pressed: the toolbar opens its Sort menu at `at`. */
export interface OpenSortMenuMeta {
  readonly at: { readonly x: number; readonly y: number }
}

export const headerSortKey = new PluginKey<DecorationSet>('tableHeaderSort')
export const HEADER_SORT_ATTR = 'data-th-sort'

/** Column index of the selection inside the table at `tablePos`, or -1. */
function activeColumn(state: EditorState, tablePos: number): number {
  if (!isInTable(state)) return -1
  const rect = selectedRect(state)
  return rect.tableStart - 1 === tablePos ? rect.left : -1
}

function chevronWidget(cellEnd: number) {
  return Decoration.widget(
    cellEnd,
    (view: EditorView, getPos) => {
      const wrap = document.createElement('span')
      wrap.className = 'native-table__th-sort'
      wrap.contentEditable = 'false'
      wrap.setAttribute(HEADER_SORT_ATTR, '')
      const button = document.createElement('button')
      button.type = 'button'
      button.title = 'Sort by this column'
      button.setAttribute('aria-label', 'Sort by this column')
      button.setAttribute('aria-haspopup', 'menu')
      button.appendChild(chevronDownSvg(12))
      button.addEventListener('mousedown', (event) => {
        event.preventDefault()
        const pos = getPos()
        if (pos === undefined) return
        const { x, y } = { x: button.getBoundingClientRect().right, y: button.getBoundingClientRect().bottom }
        const meta: OpenSortMenuMeta = { at: { x, y } }
        const { state } = view
        // Caret at the end of this header cell's text, so the Sort menu applies to this column.
        const tr = state.tr.setSelection(Selection.near(state.doc.resolve(pos), -1)).setMeta(headerSortKey, meta)
        view.dispatch(tr)
        view.focus()
      })
      wrap.appendChild(button)
      return wrap
    },
    { side: 1, ignoreSelection: true, stopEvent: () => true, key: 'th-sort' },
  )
}

/** Chevron widgets in every header-row cell + an `is-sort-column` class on the active column's header cells. */
function buildDecorations(state: EditorState): DecorationSet {
  const decorations: Decoration[] = []
  state.doc.descendants((node: PMNode, pos: number) => {
    if (node.type.spec.tableRole !== 'table') return true
    const map = TableMap.get(node)
    const active = activeColumn(state, pos)
    const headerRows = leadingHeaderRows(node)
    for (let row = 0; row < headerRows; row += 1) {
      for (let col = 0; col < map.width; col += 1) {
        const offset = map.map[row * map.width + col]
        if (offset === undefined) continue
        // A colspan cell appears once per column it covers: decorate it only at its first column.
        if (col > 0 && map.map[row * map.width + col - 1] === offset) continue
        const cell = node.nodeAt(offset)
        if (!cell) continue
        const cellPos = pos + 1 + offset
        decorations.push(chevronWidget(cellPos + cell.nodeSize - 1))
        if (col === active)
          decorations.push(Decoration.node(cellPos, cellPos + cell.nodeSize, { class: 'is-sort-column' }))
      }
    }
    return false
  })
  return DecorationSet.create(state.doc, decorations)
}

/** Header cells get a small chevron that opens the toolbar's Sort menu for that column. */
export const headerSortPlugin = () =>
  new Plugin<DecorationSet>({
    key: headerSortKey,
    state: {
      init: (_config, state) => buildDecorations(state),
      apply: (tr, previous, _old, state) =>
        tr.docChanged || tr.selectionSet ? buildDecorations(state) : previous.map(tr.mapping, tr.doc),
    },
    props: {
      decorations: (state) => headerSortKey.getState(state),
    },
  })
