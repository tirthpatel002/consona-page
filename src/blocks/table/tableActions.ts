import type { ChainedCommands, Editor } from '@tiptap/core'
import { defineOperation, type BlockToolbarAction, type BlockToolbarMenu } from '../../editor/core'
import { findSelectedTable, isInHeaderRow, leadingHeaderRows } from './tableQueries'

export type TableAction = BlockToolbarAction
export type TableMenu = BlockToolbarMenu

/** Runs one named table command (one editor command → one undo step). */
export const tableCommand = defineOperation(
  'tableCommand',
  (chain, _id: string, apply: (chain: ChainedCommands) => ChainedCommands) => apply(chain),
)

const action = (
  id: string,
  label: string,
  title: string,
  apply: (chain: ChainedCommands) => ChainedCommands,
  extra: Pick<TableAction, 'danger' | 'isActive'> & { readonly when?: (editor: Editor) => boolean } = {},
): TableAction => ({
  id,
  label,
  title,
  danger: extra.danger,
  isActive: extra.isActive,
  can: (editor) => (extra.when?.(editor) ?? true) && apply(editor.can().chain()).run(),
  run: (editor) => void tableCommand.run(editor, `table:${id}`, apply),
})

const hasHeaderRow = (editor: Editor) => {
  const table = findSelectedTable(editor.state)
  return table !== null && leadingHeaderRows(table.node) > 0
}

// Every action is one editor command → one undo step.
export const tableMenus: readonly TableMenu[] = [
  {
    id: 'add',
    label: 'Add',
    title: 'Add a row or column',
    sections: [
      [
        action('row-above', 'Row above', 'Insert row above', (c) => c.addRowBefore()),
        action('row-below', 'Row below', 'Insert row below', (c) => c.addRowAfter()),
        action('col-left', 'Column left', 'Insert column left', (c) => c.addColumnBefore()),
        action('col-right', 'Column right', 'Insert column right', (c) => c.addColumnAfter()),
      ],
    ],
  },
  {
    id: 'remove',
    label: 'Remove',
    title: 'Remove a row, a column or the table',
    sections: [
      [
        action('delete-row', 'Row', 'Delete row', (c) => c.deleteRow()),
        action('delete-col', 'Column', 'Delete column', (c) => c.deleteColumn()),
      ],
      [action('delete-table', 'Delete table', 'Delete the whole table', (c) => c.deleteTable(), { danger: true })],
    ],
  },
  {
    id: 'sort',
    label: 'Sort',
    title: 'Sort rows by this column',
    // Sorting is offered from header cells only (here and via the header cells' chevrons).
    visible: (editor) => isInHeaderRow(editor.state),
    sections: [
      [
        action(
          'sort-asc',
          'Ascending (A→Z)',
          'Sort rows by this column, ascending',
          (c) => c.sortTableByColumn('asc'),
          {
            when: (editor) => isInHeaderRow(editor.state),
          },
        ),
        action(
          'sort-desc',
          'Descending (Z→A)',
          'Sort rows by this column, descending',
          (c) => c.sortTableByColumn('desc'),
          { when: (editor) => isInHeaderRow(editor.state) },
        ),
      ],
    ],
  },
]

export const headerRowAction = action('header-row', 'Header', 'Toggle header row', (c) => c.toggleHeaderRow(), {
  isActive: hasHeaderRow,
})
export const mergeAction = action('merge', 'Merge', 'Merge selected cells', (c) => c.mergeCells())
export const splitAction = action('split', 'Split', 'Split merged cell', (c) => c.splitCell())

export const allTableActions: readonly TableAction[] = [
  ...tableMenus.flatMap((menu) => menu.sections.flat()),
  headerRowAction,
  mergeAction,
  splitAction,
]

/** The single contextual cell button: Merge wins for a mergeable multi-cell selection, else Split, else none. */
export function cellMergeAction(canMerge: boolean, canSplit: boolean): 'merge' | 'split' | null {
  if (canMerge) return 'merge'
  return canSplit ? 'split' : null
}
