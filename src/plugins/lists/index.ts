import {
  ANY_BLOCK_SOURCE,
  convertBlocksToSpec,
  nodesForShape,
  type BlockAction,
  type PagePlugin,
  type SlashItem,
  type ToolbarItem,
  type TurnIntoDefinition,
  type TurnIntoSpec,
} from '../../editor/core'
import { Checklist, ChecklistItem, MarkedBulletList, MarkedOrderedList } from './extensions'
import { BULLET_MARKERS, ORDERED_MARKERS } from './markers'
import { ITEM_TYPES, ListItemBlocks, ListItemDrop } from './itemHandles'
import { deleteWholeList, duplicateWholeList, setListMarker, toggleChecklist, toggleOrderedList } from './operations'

const isItem = (nodeType: string) => (ITEM_TYPES as readonly string[]).includes(nodeType)

const wholeListActions: BlockAction[] = [
  {
    id: 'lists:duplicate-list',
    label: 'Duplicate whole list',
    section: 'Whole list',
    appliesTo: (target) => isItem(target.nodeType),
    run: ({ editor, pos }) => void duplicateWholeList.run(editor, pos),
  },
  {
    id: 'lists:delete-list',
    label: 'Delete whole list',
    section: 'Whole list',
    danger: true,
    appliesTo: (target) => isItem(target.nodeType),
    run: ({ editor, pos }) => void deleteWholeList.run(editor, pos),
  },
]

const slashItems: readonly SlashItem[] = [
  {
    id: 'lists:checklist',
    group: 'Text',
    title: 'Checklist',
    keywords: ['todo', 'task', 'checkbox'],
    run: (editor) => void toggleChecklist.run(editor),
  },
]

const markerActions = (
  listType: 'bulletList' | 'orderedList',
  markers: readonly { id: string; label: string }[],
): BlockAction[] =>
  markers.map((marker) => ({
    id: `lists:marker-${marker.id}`,
    label: marker.label,
    style: true,
    section: listType === 'bulletList' ? 'Bullet style' : 'Number style',
    appliesTo: (target) =>
      (target.nodeType === listType && target.node.attrs.marker !== marker.id) ||
      (target.nodeType === 'listItem' && target.parentType === listType),
    run: ({ editor, pos }) => void setListMarker.run(editor, pos, marker.id),
  }))

const checklistSpec: TurnIntoSpec = {
  kind: 'chain',
  blocks: (schema, source) => nodesForShape(schema, { type: 'taskList' }, source),
}

const turnIntoChecklist: TurnIntoDefinition = {
  id: 'lists:turn-into-checklist',
  label: 'Checklist',
  target: 'taskList',
  from: [ANY_BLOCK_SOURCE],
  isCurrent: (target) =>
    target.nodeType === 'taskList' || (target.nodeType === 'taskItem' && target.parentType === 'taskList'),
  convert: ({ editor, pos }) => {
    convertBlocksToSpec.run(editor, [pos], checklistSpec)
  },
  spec: checklistSpec,
}

/**
 * Lists: checklists (nested, Tab to indent), list markers (disc/circle/square, 1/a/i) chosen from the block menu.
 * Replaces StarterKit's plain lists, so apps using it should disable those in textPlugin (it does).
 */
const listToolbarItems: readonly ToolbarItem[] = [
  {
    id: 'lists:toggle-ordered-list',
    group: 'lists',
    label: 'Numbered list',
    title: 'Numbered list',
    icon: 'ordered-list',
    isActive: (editor) => editor.isActive('orderedList'),
    run: (editor) => void toggleOrderedList.run(editor),
  },
  {
    id: 'lists:toggle-checklist',
    group: 'lists',
    label: 'Checklist',
    title: 'Checklist',
    icon: 'checklist',
    isActive: (editor) => editor.isActive('taskList'),
    run: (editor) => void toggleChecklist.run(editor),
  },
]

export const listsPlugin: PagePlugin = {
  id: 'lists',
  extensions: [MarkedBulletList, MarkedOrderedList, Checklist, ChecklistItem, ListItemBlocks, ListItemDrop],
  slashItems,
  toolbarItems: listToolbarItems,
  turnInto: [turnIntoChecklist],
  blockActions: [
    ...wholeListActions,
    ...markerActions('bulletList', BULLET_MARKERS),
    ...markerActions('orderedList', ORDERED_MARKERS),
  ],
}
