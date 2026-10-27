import { BLOCK_SLASH_GROUP, type PagePlugin } from '../../editor/core'
import { tableExtensions } from './extensions'
import { insertTable } from './operations'
import { tableToolbar } from './tableToolbar'
import './table.css'

/**
 * Editor-native table (Tiptap table extensions): every cell is ProseMirror content, so text selection,
 * marks, undo and copy/paste work across cells and surrounding blocks. Styled with the editor tokens.
 */
export const tablePlugin: PagePlugin = {
  id: 'table',
  extensions: tableExtensions,
  slashItems: [
    {
      id: 'table:insert',
      title: 'Table',
      group: BLOCK_SLASH_GROUP,
      description: 'Editor-native table, 3×3 with header row',
      keywords: ['table', 'grid', 'rows', 'columns', 'native'],
      run: (editor) => {
        insertTable.run(editor)
      },
    },
  ],
  blockToolbars: [tableToolbar],
}
