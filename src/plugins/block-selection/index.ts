import type { BlockAction, PagePlugin } from '../../editor/core'
import {
  blockSelectionActive,
  blockSelectionExtension,
  extendSelectionTo,
  runOnSelection,
  selectBlockAt,
} from './blockSelection'
import './block-selection.css'

const isBlock = (target: { node: { type: { isInGroup: (group: string) => boolean } } }) =>
  target.node.type.isInGroup('block')

/** Menu route into block selection, so touch users (no Esc, no Shift) can select, extend, delete and duplicate. */
const blockActions: readonly BlockAction[] = [
  {
    id: 'selection:select',
    label: 'Select block',
    section: 'Selection',
    appliesTo: isBlock,
    run: ({ editor, pos }) => void selectBlockAt(editor, pos),
  },
  {
    id: 'selection:extend',
    label: 'Extend selection to here',
    section: 'Selection',
    appliesTo: (target) => isBlock(target) && blockSelectionActive,
    run: ({ editor, pos }) => void extendSelectionTo(editor, pos),
  },
  {
    id: 'selection:duplicate',
    label: 'Duplicate selected blocks',
    section: 'Selection',
    appliesTo: () => blockSelectionActive,
    run: ({ editor }) => void runOnSelection(editor, 'duplicate'),
  },
  {
    id: 'selection:delete',
    label: 'Delete selected blocks',
    section: 'Selection',
    danger: true,
    appliesTo: () => blockSelectionActive,
    run: ({ editor }) => void runOnSelection(editor, 'delete'),
  },
]

/** Whole-block selection: keyboard, marquee / Shift+click, copy, cut, duplicate, delete, multi-block drag. */
export const blockSelectionPlugin: PagePlugin = {
  id: 'block-selection',
  extensions: [blockSelectionExtension],
  blockActions,
}
