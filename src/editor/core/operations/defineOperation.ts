import type { ChainedCommands, Editor } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'

const joinNext = new WeakSet<Editor>()

/**
 * The next operation run on `editor` in this tick joins the previous undo step instead of starting its own
 * (used by the "+" menu, whose scaffold paragraph and chosen item must undo together).
 */
export function joinNextOperation(editor: Editor): void {
  joinNext.add(editor)
  setTimeout(() => joinNext.delete(editor), 0)
}

/** Transaction meta key carrying the id of the named operation that produced the transaction. */
export const OPERATION_META = 'page:operation'

/**
 * A named, typed command. Everything that changes the page goes through one of these
 * (never raw `editor.view.dispatch` in a component). Each run is ONE transaction, so it is
 * one undo step, and the id is stamped on it for logging / later collaboration.
 */
export interface Operation<Args extends readonly unknown[]> {
  readonly id: string
  readonly run: (editor: Editor, ...args: Args) => boolean
}

export function defineOperation<Args extends readonly unknown[]>(
  id: string,
  build: (chain: ChainedCommands, ...args: Args) => ChainedCommands,
): Operation<Args> {
  return {
    id,
    run: (editor, ...args) =>
      build(editor.chain().focus(), ...args)
        .setMeta(OPERATION_META, id)
        // Every named operation is its own undo step, even when run right after another edit.
        .command(({ tr }) => {
          if (!joinNext.delete(editor)) closeHistory(tr)
          return true
        })
        .run(),
  }
}

/** The operation id stamped on a transaction, if any. */
export function operationOf(tr: { getMeta: (key: string) => unknown }): string | undefined {
  const value = tr.getMeta(OPERATION_META)
  return typeof value === 'string' ? value : undefined
}
