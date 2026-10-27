import type { Node as PMNode } from '@tiptap/pm/model'
import { BLOCK_REMOVAL_META, defineOperation } from '../../editor/core'

/**
 * Sets the marker on the list at `pos`, or on the list that holds the item at `pos` (one undoable step; does not
 * need the selection to be inside it).
 */
export const setListMarker = defineOperation('setListMarker', (chain, pos: number, marker: string) =>
  chain.command(({ tr }) => {
    let node = tr.doc.nodeAt(pos)
    if (!node) return false
    let at = pos
    if (!/List$/.test(node.type.name)) {
      const list = listAround(tr.doc, pos)
      if (!list) return false
      node = list.node
      at = list.from
    }
    tr.setNodeMarkup(at, undefined, { ...node.attrs, marker })
    return true
  }),
)

export const toggleChecklist = defineOperation('toggleChecklist', (chain) => chain.toggleList('taskList', 'taskItem'))

export const toggleOrderedList = defineOperation('toggleOrderedList', (chain) =>
  chain.toggleList('orderedList', 'listItem'),
)

export const indentListItem = defineOperation('indentListItem', (chain, item: 'listItem' | 'taskItem') =>
  chain.sinkListItem(item),
)

export const outdentListItem = defineOperation('outdentListItem', (chain, item: 'listItem' | 'taskItem') =>
  chain.liftListItem(item),
)

/** Range of the list that holds the item at `pos`, or null when `pos` is not a list item. */
function listAround(doc: PMNode, pos: number) {
  const item = doc.nodeAt(pos)
  if (!item) return null
  const $pos = doc.resolve(pos)
  const list = $pos.parent
  if (!/List$/.test(list.type.name) || $pos.depth === 0) return null
  return { from: $pos.before(), to: $pos.after(), node: list }
}

/** Deletes the whole list around the item at `pos` (one undo step). */
export const deleteWholeList = defineOperation('deleteWholeList', (chain, pos: number) =>
  chain.command(({ tr, dispatch }) => {
    const list = listAround(tr.doc, pos)
    if (!list) return false
    if (dispatch) {
      tr.setMeta(BLOCK_REMOVAL_META, { from: list.from, to: list.to })
      tr.delete(list.from, list.to)
    }
    return true
  }),
)

/** Duplicates the whole list around the item at `pos` right below itself (one undo step). */
export const duplicateWholeList = defineOperation('duplicateWholeList', (chain, pos: number) =>
  chain.command(({ tr, dispatch }) => {
    const list = listAround(tr.doc, pos)
    if (!list) return false
    if (dispatch) tr.insert(list.to, list.node)
    return true
  }),
)
