import { Extension } from '@tiptap/core'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { headerOnlyResizePlugin } from './headerOnlyResize'
import { headerSortPlugin } from './headerSort'
import { NativeTableView } from './NativeTableView'
import type { SortDirection } from './sortRows'
import { reorderHandlesPlugin } from './reorderHandles'
import { sortTableByColumn } from './sortTable'
import { moveColumnBy, moveRowBy } from './tableMoveCommands'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableMove: {
      /** Moves the selected column one step left (-1) or right (1); one undo step. */
      moveTableColumnBy: (delta: -1 | 1) => ReturnType
      /** Moves the selected body row one step up (-1) or down (1); header rows stay on top. */
      moveTableRowBy: (delta: -1 | 1) => ReturnType
    }
    tableSort: {
      /** Reorders the body rows of the current table by the selected column (undoable). */
      sortTableByColumn: (direction: SortDirection) => ReturnType
    }
  }
}

/** Tiptap's table node with our node view (toolbar slot) and column resizing from header cells only. */
const NativeTable = Table.extend({
  addNodeView() {
    const { cellMinWidth } = this.options
    return ({ node }) => new NativeTableView(node, cellMinWidth)
  },
  addProseMirrorPlugins() {
    // The guard must see mouse events before columnResizing (plugin order = handler order).
    return [headerOnlyResizePlugin(), ...(this.parent?.() ?? [])]
  },
}).configure({
  resizable: true,
  cellMinWidth: 64,
  lastColumnResizable: true,
  // Keep real NodeSelections of the table (gutter handle click / drag); otherwise they become CellSelections.
  allowTableNodeSelection: true,
  HTMLAttributes: { class: 'native-table__table' },
})

const TableMove = Extension.create({
  name: 'tableMove',
  addProseMirrorPlugins: () => [reorderHandlesPlugin()],
  addCommands() {
    return {
      moveTableColumnBy:
        (delta) =>
        ({ state, dispatch }) =>
          moveColumnBy(delta)(state, dispatch),
      moveTableRowBy:
        (delta) =>
        ({ state, dispatch }) =>
          moveRowBy(delta)(state, dispatch),
    }
  },
})

const TableSort = Extension.create({
  name: 'tableSort',
  addProseMirrorPlugins: () => [headerSortPlugin()],
  addCommands() {
    return {
      sortTableByColumn:
        (direction) =>
        ({ state, dispatch }) =>
          sortTableByColumn(direction)(state, dispatch),
    }
  },
})

/**
 * When the whole table is node-selected (after a gutter-handle click), pressing inside a cell would make
 * ProseMirror start dragging the selected node. Put the caret in the cell first, so text selection
 * wins and only the handle drags.
 */
const TableDragGuard = Extension.create({
  name: 'tableDragGuard',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tableDragGuard'),
        props: {
          handleDOMEvents: {
            mousedown(view, event) {
              const { selection } = view.state
              if (!(selection instanceof NodeSelection) || selection.node.type.spec.tableRole !== 'table') return false
              if (!(event.target instanceof Element) || !event.target.closest('td, th')) return false
              const hit = view.posAtCoords({ left: event.clientX, top: event.clientY })
              if (!hit) return false
              view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(hit.pos))))
              return false
            },
          },
        },
      }),
    ]
  },
})

export const tableExtensions = [NativeTable, TableRow, TableHeader, TableCell, TableSort, TableMove, TableDragGuard]
