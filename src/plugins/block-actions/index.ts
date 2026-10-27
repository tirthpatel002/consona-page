import type { PagePlugin } from '../../editor/core'
import { deleteBlock, duplicateBlock, moveBlockOp } from './operations'

/** Generic block-menu actions available on every top-level block (text, lists, tables, embeds). */
export const blockActionsPlugin: PagePlugin = {
  id: 'block-actions',
  blockActions: [
    { id: 'block:duplicate', label: 'Duplicate', run: ({ editor, pos }) => void duplicateBlock.run(editor, pos) },
    { id: 'block:move-up', label: 'Move up', run: ({ editor, pos }) => void moveBlockOp.run(editor, pos, 'up') },
    { id: 'block:move-down', label: 'Move down', run: ({ editor, pos }) => void moveBlockOp.run(editor, pos, 'down') },
    {
      id: 'block:delete',
      label: 'Delete',
      danger: true,
      run: ({ editor, pos }) => void deleteBlock.run(editor, pos),
    },
  ],
}
