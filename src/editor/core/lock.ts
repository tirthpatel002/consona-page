import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageLock: {
      /** Lock/unlock the page. Locked means read-only: no document mutation from any source; links still work. */
      setPageLocked: (locked: boolean) => ReturnType
    }
  }
  interface Storage {
    pageLock: { locked: boolean }
  }
}

const LOCK_META = 'pageLock'

/**
 * The page lock (B4). The toolbar toggle only asks; the guarantee lives here: while locked, every
 * document-changing transaction is filtered out no matter where it comes from (typing, paste, drag,
 * undo, panel edits), and the editor surface is non-editable so there is no caret or IME. Selection,
 * copying and link clicks are not document changes and keep working.
 */
export const pageLockExtension = Extension.create({
  name: 'pageLock',

  addStorage() {
    return { locked: false }
  },

  addCommands() {
    return {
      setPageLocked:
        (locked: boolean) =>
        ({ editor, state, dispatch }) => {
          editor.setEditable(!locked)
          if (dispatch) dispatch(state.tr.setMeta(LOCK_META, locked))
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    return [
      new Plugin<boolean>({
        key: new PluginKey<boolean>('pageLock'),
        state: {
          init: () => storage.locked as boolean,
          apply(tr, value) {
            const meta = tr.getMeta(LOCK_META)
            if (typeof meta === 'boolean') {
              storage.locked = meta
              return meta
            }
            return value
          },
        },
        filterTransaction: (tr) => {
          if (!storage.locked) return true
          if (typeof tr.getMeta(LOCK_META) === 'boolean') return true
          return !tr.docChanged
        },
      }),
    ]
  },
})
