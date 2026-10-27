import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import {
  DROP_TARGET_STORAGE,
  NESTED_BLOCKS_STORAGE,
  blockEntries,
  moveBlocksTo,
  type DropProposal,
} from '../../editor/core'

export const LIST_TYPES = ['bulletList', 'orderedList', 'taskList'] as const
export const ITEM_TYPES = ['listItem', 'taskItem'] as const

/**
 * Gives every list item its own gutter handle (nested items too). Lists are structure inside lists; a top-level
 * list keeps its own handle, reached from the list's marker margin, and its actions also appear in each item's menu.
 */
export const ListItemBlocks = Extension.create({
  name: `${NESTED_BLOCKS_STORAGE}Lists`,
  addStorage() {
    return { containers: [...LIST_TYPES, ...ITEM_TYPES], addressable: [...ITEM_TYPES], owners: [...ITEM_TYPES] }
  },
})

interface DropStorage {
  view: EditorView | null
  editor: Editor | null
  resolve: (context: { x: number; y: number; from: number; to: number }) => DropProposal | null
}

/** Drag of a list item: drop it before or after any other item of the same kind (same or another list, any depth). */
export const ListItemDrop = Extension.create<unknown, DropStorage>({
  name: `${DROP_TARGET_STORAGE}Lists`,
  addStorage() {
    return {
      view: null,
      editor: null,
      resolve(this: DropStorage, { x, y, from, to }) {
        const { view, editor } = this
        if (!view || !editor) return null
        const dragged = view.state.doc.nodeAt(from)
        if (!dragged || !(ITEM_TYPES as readonly string[]).includes(dragged.type.name)) return null
        const options = { addressable: ITEM_TYPES, owners: ITEM_TYPES }
        const hits = blockEntries(view, [...LIST_TYPES, ...ITEM_TYPES], options)
          .filter((e) => e.node.type === dragged.type && !(e.pos >= from && e.pos < to))
          .map((entry) => ({ entry, rect: entry.dom.getBoundingClientRect() }))
          .filter(({ rect }) => y >= rect.top && y <= rect.bottom && x >= rect.left - 48 && x <= rect.right)
          .sort((a, b) => b.entry.depth - a.entry.depth)
        const hit = hits[0]
        if (!hit) return null
        const { entry, rect } = hit
        const before = y < (rect.top + Math.min(rect.bottom, rect.top + 32)) / 2
        const at = before ? entry.pos : entry.pos + entry.node.nodeSize
        if (at >= from && at <= to) return null
        return {
          rect: { left: rect.left, top: before ? rect.top - 2 : rect.bottom + 1, width: rect.width, height: 3 },
          commit: () => void moveBlocksTo.run(editor, from, to, at),
        }
      },
    }
  },
  addProseMirrorPlugins() {
    const storage = this.storage
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('pageListItemDrop'),
        view(view) {
          storage.view = view
          storage.editor = editor
          return {
            destroy() {
              storage.view = null
            },
          }
        },
      }),
    ]
  },
})
