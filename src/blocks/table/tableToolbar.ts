import type { BlockToolbarDefinition } from '../../editor/core'
import { headerSortKey, HEADER_SORT_ATTR, type OpenSortMenuMeta } from './headerSort'
import { TABLE_TOOLBAR_SLOT } from './NativeTableView'
import { headerRowAction, mergeAction, splitAction, tableMenus } from './tableActions'
import { findSelectedTable } from './tableQueries'

/** The table's contextual toolbar, declared through the core's block-toolbar contribution API. */
export const tableToolbar: BlockToolbarDefinition = {
  id: 'table:toolbar',
  label: 'Table',
  locate: (editor) => findSelectedTable(editor.state)?.pos ?? null,
  slot: (blockDom) => blockDom.querySelector(`[${TABLE_TOOLBAR_SLOT}]`),
  groups: [
    { kind: 'menus', menus: tableMenus },
    { kind: 'buttons', actions: [headerRowAction] },
    // Merge wins for a mergeable multi-cell selection, else Split, else nothing.
    { kind: 'first-enabled', actions: [mergeAction, splitAction] },
  ],
  // A header chevron moved the caret into its cell and asked for the Sort menu (toggles).
  menuRequest: (transaction) => {
    const meta = transaction.getMeta(headerSortKey) as OpenSortMenuMeta | undefined
    return meta ? { menuId: 'sort', at: meta.at } : null
  },
  isMenuOpener: (target) => target.closest(`[${HEADER_SORT_ATTR}]`) !== null,
}
