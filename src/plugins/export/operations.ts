import type { JSONContent } from '@tiptap/core'
import { defineOperation } from '../../editor/core'

/** Inserts converted blocks (imported file or pasted HTML/Markdown) at the selection as one undo step. */
export const insertConverted = defineOperation('insertConverted', (chain, blocks: readonly JSONContent[]) =>
  chain.insertContent(blocks as JSONContent[]),
)
