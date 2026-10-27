import type { EditorState } from '@tiptap/pm/state'
import { isJsonObject } from '../json'
import { BLOCK_NODE_NAME } from '../block/blockNodeOptions'
import type { BlockTarget } from '../block/types'

/** Describes the top-level block at `pos` for the block menu, or null if there is none. */
export function blockTargetAt(state: EditorState, pos: number): BlockTarget | null {
  if (pos < 0 || pos >= state.doc.content.size) return null
  const $pos = state.doc.resolve(pos)
  const node = $pos.nodeAfter
  if (!node) return null
  const isEmbed = node.type.name === BLOCK_NODE_NAME
  const blockType = isEmbed && typeof node.attrs.blockType === 'string' ? node.attrs.blockType : node.type.name
  const props = isEmbed && isJsonObject(node.attrs.props) ? node.attrs.props : {}
  return { pos, node, nodeType: node.type.name, parentType: $pos.parent.type.name, blockType, isEmbed, props }
}
