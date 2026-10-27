import { defineOperation, type JsonObject } from '../../editor/core'

/** Applies edited props to the block at `pos`, then keeps it node-selected. One undo step. */
export const applyBlockProps = defineOperation('applyBlockProps', (chain, pos: number, props: JsonObject) =>
  chain.updateBlockProps(pos, props).setNodeSelection(pos),
)
