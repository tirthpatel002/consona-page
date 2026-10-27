import { removeSlashRange } from './operations'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import { filterSlashItems } from './filterSlashItems'
import type { SlashStore } from './slashStore'
import type { SlashItem } from './types'

export interface SlashExtensionOptions {
  readonly items: readonly SlashItem[]
  readonly store: SlashStore
}

const slashPluginKey = new PluginKey('slashMenu')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    slashMenu: {
      /**
       * Inserts an empty default block (paragraph) after the top-level block at `pos`, puts the caret in it and
       * opens the slash menu there. Dismissing the menu without choosing leaves the empty paragraph.
       */
      openSlashMenuBelow: (pos: number) => ReturnType
    }
  }
}

/**
 * Session of a menu opened with "+": the position of its empty paragraph. The menu lists items for whatever is
 * typed in that paragraph, with no "/" in the document. It ends when the caret leaves the paragraph, on Escape,
 * or when an item is chosen.
 */
const plusKey = new PluginKey<number | null>('slashPlus')

/** "/" command menu. Items come from the composed plugin registry. */
export function createSlashExtension(options: SlashExtensionOptions) {
  return Extension.create<SlashExtensionOptions>({
    name: 'slashMenu',
    addOptions: () => options,
    addCommands() {
      return {
        openSlashMenuBelow:
          (pos) =>
          ({ tr, state, dispatch }) => {
            const node = pos >= 0 && pos < tr.doc.content.size ? tr.doc.nodeAt(pos) : null
            const type = state.schema.topNodeType.contentMatch.defaultType
            if (!node || tr.doc.resolve(pos).depth !== 0 || !type?.isTextblock) return false
            if (dispatch) {
              const at = pos + node.nodeSize
              tr.insert(at, type.create())
              tr.setSelection(TextSelection.create(tr.doc, at + 1)).scrollIntoView()
              tr.setMeta(plusKey, at)
              // The scaffold (empty paragraph) is not an undo step: undoing the chosen item restores it.
              tr.setMeta('addToHistory', false)
            }
            return true
          },
      }
    },
    addProseMirrorPlugins() {
      const { editor } = this
      const { items, store } = this.options
      const endPlus = () => editor.view.dispatch(editor.state.tr.setMeta(plusKey, null).setMeta('addToHistory', false))
      const plusPlugin = new Plugin<number | null>({
        key: plusKey,
        state: {
          init: () => null,
          apply(tr, value, _old, state) {
            const meta = tr.getMeta(plusKey) as number | null | undefined
            if (meta !== undefined) return meta
            if (value === null) return null
            const at = tr.mapping.map(value)
            const node = state.doc.nodeAt(at)
            const { from, to } = state.selection
            const inside = node?.isTextblock === true && from === to && from > at && from <= at + node.nodeSize - 1
            return inside ? at : null
          },
        },
        props: {
          handleKeyDown: (_view, event) => {
            if ((plusKey.getState(editor.state) ?? null) === null) return false
            const handled = store.handleKey(event)
            if (handled && event.key === 'Escape') endPlus()
            return handled
          },
        },
        view: () => ({
          update: (view) => {
            const at = plusKey.getState(view.state)
            if (at === null || at === undefined) {
              if (store.getState().open && !slashPluginKey.getState(view.state)?.active) store.close()
              return
            }
            const node = view.state.doc.nodeAt(at)
            if (!node) return
            const query = node.textContent
            const from = at + 1
            const rect = view.coordsAtPos(view.state.selection.from)
            store.show(
              filterSlashItems(items, query),
              new DOMRect(rect.left, rect.top, 0, rect.bottom - rect.top),
              (item) => {
                endPlus()
                removeSlashRange.run(editor, from, from + query.length, true)
                item.run(editor)
              },
            )
          },
        }),
      })
      return [
        plusPlugin,
        Suggestion<SlashItem, SlashItem>({
          editor: this.editor,
          pluginKey: slashPluginKey,
          char: '/',
          allow: ({ state, range }) => state.doc.resolve(range.from).parent.type.name !== 'codeBlock',
          items: ({ query }) => filterSlashItems(items, query),
          command: ({ editor, range, props: item }) => {
            removeSlashRange.run(editor, range.from, range.to, false)
            item.run(editor)
          },
          render: () => ({
            onStart: (props) => store.show(props.items, props.clientRect?.() ?? null, props.command),
            onUpdate: (props) => store.show(props.items, props.clientRect?.() ?? null, props.command),
            onKeyDown: ({ event }) => store.handleKey(event),
            onExit: () => store.close(),
          }),
        }),
      ]
    },
  })
}
