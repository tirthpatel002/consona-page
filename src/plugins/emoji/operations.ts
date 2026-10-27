import { defineOperation } from '../../editor/core'

/** Inserts an emoji at the caret (toolbar picker). */
export const insertEmoji = defineOperation('insertEmoji', (chain, char: string) => chain.insertContent(char))

/** Replaces the ":query" range with the chosen emoji (inline suggestion). */
export const replaceWithEmoji = defineOperation(
  'replaceWithEmoji',
  (chain, range: { from: number; to: number }, char: string) =>
    chain.deleteRange({ from: range.from, to: range.to }).insertContent(char),
)
