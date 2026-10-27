import type { ChainedCommands } from '@tiptap/core'
import { defineOperation } from '../../editor/core'

export const setParagraph = defineOperation('setParagraph', (chain) => chain.setParagraph())
export const setHeading = defineOperation('setHeading', (chain, level: 1 | 2 | 3) => chain.setHeading({ level }))
export const toggleHeading = defineOperation('toggleHeading', (chain, level: 1 | 2 | 3) =>
  chain.toggleHeading({ level }),
)
export const toggleBulletList = defineOperation('toggleBulletList', (chain) => chain.toggleBulletList())
export const toggleOrderedList = defineOperation('toggleOrderedList', (chain) => chain.toggleOrderedList())
export const toggleBlockquote = defineOperation('toggleBlockquote', (chain) => chain.toggleBlockquote())
export const toggleCodeBlock = defineOperation('toggleCodeBlock', (chain) => chain.toggleCodeBlock())
export {
  insertToggleFromSelection as setToggle,
  setToggleHeadingOnEmbed as setToggleHeading,
} from '../../blocks/toggle'
export const insertDivider = defineOperation('insertDivider', (chain) => chain.setHorizontalRule())

/** Selects the text of one block and converts it with `apply` (Turn into ...), as one undo step. */
export const convertBlock = defineOperation(
  'convertBlock',
  (chain, from: number, to: number, apply: (chain: ChainedCommands) => ChainedCommands) =>
    apply(chain.setTextSelection({ from, to })),
)
