import { TextSelection } from '@tiptap/pm/state'
import { defineOperation } from '../../editor/core'
import type { CardTone } from './extensions'

/** Inserts an empty card after the current block (or in place of an empty paragraph), caret inside it. */
export const insertCard = defineOperation('insertCard', (chain) =>
  chain.command(({ state, tr, dispatch }) => {
    const type = state.schema.nodes.card
    if (!type) return false
    const { $from } = state.selection
    for (let depth = $from.depth; depth > 0; depth -= 1) if ($from.node(depth).type === type) return false
    if (dispatch) {
      const block = $from.node(1)
      const start = $from.before(1)
      const replace = block.type.name === 'paragraph' && block.content.size === 0
      const node = type.createAndFill()
      if (!node) return false
      const at = replace ? start : start + block.nodeSize
      if (replace) tr.replaceWith(start, start + block.nodeSize, node)
      else tr.insert(at, node)
      tr.setSelection(TextSelection.near(tr.doc.resolve(at + 2)))
    }
    return true
  }),
)

/** Sets the tone of the card at `pos`. */
export const setCardTone = defineOperation('setCardTone', (chain, pos: number, tone: CardTone) =>
  chain.command(({ state, tr, dispatch }) => {
    const node = state.doc.nodeAt(pos)
    if (node?.type.name !== 'card' || node.attrs.tone === tone) return false
    if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, tone })
    return true
  }),
)

/** Replaces the card at `pos` with the blocks it contains. */
export const unwrapCard = defineOperation('unwrapCard', (chain, pos: number) =>
  chain.command(({ state, tr, dispatch }) => {
    const node = state.doc.nodeAt(pos)
    if (node?.type.name !== 'card') return false
    if (dispatch) tr.replaceWith(pos, pos + node.nodeSize, node.content)
    return true
  }),
)
