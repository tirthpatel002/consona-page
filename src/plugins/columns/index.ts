import type { BlockAction, PagePlugin, SlashItem } from '../../editor/core'
import { Column, ColumnList, MAX_COLUMNS, MIN_COLUMNS, maxCells } from './extensions'
import {
  addColumn,
  insertColumns,
  removeLastColumn,
  setColumnsLayout,
  setGridTracks,
  ungroupColumns,
} from './operations'
import { ColumnDrop, ColumnResize, ColumnTidy, GridResize, NestedBlocks } from './behavior'
import './columns.css'

const GROUP = 'Layout'

const slashItems: readonly SlashItem[] = [
  ...[2, 3, 4].map((count): SlashItem => ({
    id: `columns:${count}`,
    group: GROUP,
    title: `${count} columns`,
    keywords: ['column', 'layout', 'side by side', String(count)],
    run: (editor) => void insertColumns.run(editor, count, 'columns'),
  })),
  {
    id: 'columns:grid',
    group: GROUP,
    title: 'Grid',
    keywords: ['grid', 'cards', 'tiles'],
    run: (editor) => void insertColumns.run(editor, 4, 'grid'),
  },
]

const isList = (target: { nodeType: string }) => target.nodeType === 'columnList'

const trackActions: BlockAction[] = [null, 2, 3, 4, 5, 6].map((tracks) => ({
  id: `columns:tracks-${tracks ?? 'auto'}`,
  label: tracks === null ? 'Grid: fit as many per row as possible' : `Grid: ${tracks} per row`,
  style: true,
  section: 'Grid',
  appliesTo: (target) =>
    isList(target) && target.node.attrs.layout === 'grid' && (target.node.attrs.tracks ?? null) !== tracks,
  run: ({ editor, pos }) => void setGridTracks.run(editor, pos, tracks),
}))

const blockActions: readonly BlockAction[] = [
  ...trackActions,
  {
    id: 'columns:add',
    label: 'Add column',
    section: 'Columns',
    appliesTo: (target) => isList(target) && target.node.childCount < maxCells(target.node.attrs.layout),
    run: ({ editor, pos }) => void addColumn.run(editor, pos),
  },
  {
    id: 'columns:remove',
    label: 'Remove last column',
    section: 'Columns',
    appliesTo: (target) => isList(target) && target.node.childCount > MIN_COLUMNS,
    run: ({ editor, pos }) => void removeLastColumn.run(editor, pos),
  },
  {
    id: 'columns:as-grid',
    label: 'Show as grid',
    style: true,
    section: 'Columns',
    appliesTo: (target) => isList(target) && target.node.attrs.layout !== 'grid',
    run: ({ editor, pos }) => void setColumnsLayout.run(editor, pos, 'grid'),
  },
  {
    id: 'columns:as-columns',
    label: 'Show as columns',
    style: true,
    section: 'Columns',
    appliesTo: (target) =>
      isList(target) && target.node.attrs.layout === 'grid' && target.node.childCount <= MAX_COLUMNS,
    run: ({ editor, pos }) => void setColumnsLayout.run(editor, pos, 'columns'),
  },
  {
    id: 'columns:ungroup',
    label: 'Ungroup columns',
    section: 'Columns',
    appliesTo: isList,
    run: ({ editor, pos }) => void ungroupColumns.run(editor, pos),
  },
]

/** Columns and grid: side-by-side blocks inside one layout block. */
export const columnsPlugin: PagePlugin = {
  id: 'columns',
  extensions: [ColumnList, Column, NestedBlocks, ColumnDrop, ColumnResize, GridResize, ColumnTidy],
  slashItems,
  blockActions,
}
