import { updateColumns } from '@tiptap/extension-table'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { NodeView, ViewMutationRecord } from '@tiptap/pm/view'

import { REORDER_LAYER_ATTR } from './reorderDrag'

export const TABLE_TOOLBAR_SLOT = 'data-table-toolbar-slot'

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement) => {
  const node = document.createElement(tag)
  node.className = className
  parent?.appendChild(node)
  return node
}

/**
 * DOM node view for the table node (replaces Tiptap's TableView, keeps its column-width logic).
 *
 *   div.native-table
 *     div[data-table-toolbar-slot]   portal target for the contextual toolbar (React)
 *     div.native-table__scroll > table > colgroup + tbody(contentDOM)
 *
 * Cells are ordinary ProseMirror content inside `tbody`. Moving / the block menu come from the
 * editor's generic block gutter (drag handle), like every other top-level block.
 */
export class NativeTableView implements NodeView {
  readonly dom: HTMLElement
  readonly contentDOM: HTMLElement
  private readonly table: HTMLTableElement
  private readonly colgroup: HTMLTableColElement

  constructor(
    private node: PMNode,
    private readonly cellMinWidth: number,
  ) {
    this.dom = el('div', 'native-table')
    this.dom.dataset.blockFeedback = 'shell'
    const slot = el('div', 'native-table__toolbar-slot', this.dom)
    slot.contentEditable = 'false'
    slot.setAttribute(TABLE_TOOLBAR_SLOT, '')

    const scroll = el('div', 'native-table__scroll page-block__shell tableWrapper', this.dom)
    this.table = el('table', 'native-table__table', scroll)
    this.colgroup = el('colgroup', '', this.table)
    updateColumns(node, this.colgroup, this.table, cellMinWidth)
    this.contentDOM = el('tbody', '', this.table)
    // Non-editable layer for the drag ghost and drop line (ProseMirror ignores it: it is outside contentDOM).
    const layer = el('div', 'native-table__reorder-layer', scroll)
    layer.contentEditable = 'false'
    layer.setAttribute(REORDER_LAYER_ATTR, '')
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    // Tiptap's updateColumns never clears a <col>'s inline width once a column loses its colwidth (e.g. undoing
    // a resize), so reset them; it re-applies every stored width.
    for (const col of this.colgroup.querySelectorAll('col')) col.style.width = ''
    updateColumns(node, this.colgroup, this.table, this.cellMinWidth)
    return true
  }

  /** Same classes ProseMirror's default uses, so the editor's one selection ring applies to tables too. */
  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode', 'is-selected')
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode', 'is-selected')
  }

  /** The editor ignores events on the toolbar slot (its React UI handles them). */
  stopEvent(event: Event): boolean {
    const target = event.target
    return (
      target instanceof Element &&
      !this.contentDOM.contains(target) &&
      target.closest('[data-table-toolbar-slot]') !== null
    )
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    if (mutation.type === 'selection') return false
    return !this.contentDOM.contains(mutation.target)
  }
}
