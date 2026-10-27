import type { Editor } from '@tiptap/core'
import { defineOperation, joinNextOperation, OPERATION_META, type Operation } from '../operations/defineOperation'

const removeText = defineOperation('removeSlashRange', (chain, from: number, to: number) =>
  chain.command(({ tr }) => {
    tr.delete(from, to)
    return true
  }),
)

/**
 * Removes the "/query" text before the chosen item runs.
 *
 * For a menu opened with "+", the scaffold paragraph was not recorded as an undo step. So the scaffold is
 * swapped (outside history) for an identical empty paragraph that IS recorded, in the same tick as the chosen
 * item. The empty paragraph and the item then form one undo group: one undo restores the exact prior document.
 */
export const removeSlashRange: Operation<[from: number, to: number, fromPlus: boolean]> = {
  id: 'removeSlashRange',
  run: (editor: Editor, from, to, fromPlus) => {
    if (!fromPlus) return removeText.run(editor, from, to)
    const { doc } = editor.state
    const $from = doc.resolve(from)
    const scaffold = $from.parent
    const onlyQuery = $from.depth === 1 && scaffold.isTextblock && scaffold.textContent === doc.textBetween(from, to)
    if (!onlyQuery) return removeText.run(editor, from, to)
    const start = $from.before()
    editor.view.dispatch(editor.state.tr.delete(start, $from.after()).setMeta('addToHistory', false))
    const done = editor
      .chain()
      .focus()
      .insertContentAt(start, { type: scaffold.type.name })
      .setTextSelection(start + 1)
      .setMeta(OPERATION_META, 'removeSlashRange')
      .run()
    joinNextOperation(editor)
    return done
  },
}

/** Opens the slash menu in a new empty paragraph below the block at `pos` (the "+" button). */
export const openSlashMenuBelow = defineOperation('openSlashMenuBelow', (chain, pos: number) =>
  chain.openSlashMenuBelow(pos),
)
