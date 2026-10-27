import { Plugin, PluginKey } from '@tiptap/pm/state'
import { columnResizingPluginKey } from '@tiptap/pm/tables'
import type { EditorView } from '@tiptap/pm/view'
import { isHeaderRowPos } from './tableQueries'

export const headerOnlyResizeKey = new PluginKey('tableHeaderOnlyResize')

/** Drops columnResizing's hover handle (unless a resize drag is in progress). */
function clearHandle(view: EditorView): void {
  const resize = columnResizingPluginKey.getState(view.state)
  if (resize && resize.activeHandle > -1 && !resize.dragging) {
    view.dispatch(view.state.tr.setMeta(columnResizingPluginKey, { setHandle: -1 }))
  }
}

/** Whether `target` is (inside) a table cell of this editor that is not in a leading header row. */
function isBodyCellTarget(view: EditorView, target: EventTarget | null): boolean {
  const cell = target instanceof Element ? target.closest('td, th') : null
  if (!cell || !view.dom.contains(cell)) return false
  return !isHeaderRowPos(view.state.doc.resolve(view.posAtDOM(cell, 0)))
}

/**
 * Columns resize from header-row cells only. Must run before prosemirror-tables' `columnResizing`
 * plugin: hovering a body cell's edge never activates a resize handle (so no cursor, no handle, and a
 * mousedown there cannot start a resize). A drag started from a header edge keeps working across rows,
 * because columnResizing tracks it with window listeners.
 */
export function headerOnlyResizePlugin(): Plugin {
  return new Plugin({
    key: headerOnlyResizeKey,
    props: {
      handleDOMEvents: {
        mousemove(view, event) {
          if (!isBodyCellTarget(view, event.target)) return false
          clearHandle(view)
          return true // handled: columnResizing never sees body-cell hovers
        },
        mousedown(view) {
          const resize = columnResizingPluginKey.getState(view.state)
          if (resize && resize.activeHandle > -1 && !isHeaderRowPos(view.state.doc.resolve(resize.activeHandle))) {
            clearHandle(view)
          }
          return false
        },
      },
    },
  })
}
