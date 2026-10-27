import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection, PluginKey, type EditorState } from '@tiptap/pm/state'
import { convertBlocksToSpec, convertPartialSelectionToSpec } from '../operations/operations'
import type { BlockAction, BlockTarget } from './types'
import { isJsonObject } from '../json'
import { definitionFitsTargets, sourceMatches, TURN_INTO_SECTION, type TurnIntoDefinition } from './turnInto'

/**
 * A selection context for "Turn into": the block or blocks the selection covers (including a list item,
 * quote, code block, table, or card, not only a top-level paragraph), or a partial range inside one
 * text block.
 */
export type TurnIntoSelectionContext =
  | { readonly kind: 'whole'; readonly positions: readonly number[] }
  | {
      readonly kind: 'partial'
      readonly from: number
      readonly to: number
      readonly blockPos: number
      readonly splitBefore: boolean
      readonly splitAfter: boolean
    }

interface TouchedBlock {
  readonly pos: number
  readonly node: PMNode
}

/** Parents that must stay put: a selection inside them converts the text, not the layout shell. */
const HALT_PROMOTION = new Set(['column', 'columnList'])

/** Structural wrappers with no identity of their own. The walk continues to the table or list that holds them. */
const SKIP_PROMOTION = new Set(['tableCell', 'tableHeader', 'tableRow'])

const textblocksBetween = (state: EditorState, from: number, to: number): TouchedBlock[] => {
  const found: TouchedBlock[] = []
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true
    const start = pos + 1
    const end = pos + node.nodeSize - 1
    if (start < to && end > from) found.push({ pos, node })
    return false
  })
  return found
}

/** Positions of every textblock inside `node` (itself, when it is one). */
const textblockPositions = (node: PMNode, nodePos: number): number[] => {
  if (node.isTextblock) return [nodePos]
  const positions: number[] = []
  node.descendants((child, offset) => {
    if (child.isTextblock) {
      positions.push(nodePos + 1 + offset)
      return false
    }
    return true
  })
  return positions
}

const coversBlock = (block: TouchedBlock, from: number, to: number): boolean =>
  from <= block.pos + 1 && to >= block.pos + block.node.nodeSize - 1

/**
 * Whole blocks the selection covers. A fully selected quote, list, list item, card, or table is one
 * target; a column or table cell is not, so the text inside it converts in place.
 */
const promoteToBlocks = (state: EditorState, blocks: readonly TouchedBlock[]): number[] => {
  const selected = new Set(blocks.map((block) => block.pos))
  const remaining = [...blocks]
  const positions: number[] = []
  while (remaining.length > 0) {
    const first = remaining[0]
    if (!first) break
    let bestPos = first.pos
    let bestNode = first.node
    const $inside = state.doc.resolve(first.pos + 1)
    for (let depth = $inside.depth - 1; depth >= 1; depth -= 1) {
      const ancestor = $inside.node(depth)
      const name = ancestor.type.name
      if (HALT_PROMOTION.has(name)) break
      if (SKIP_PROMOTION.has(name)) continue
      const ancestorPos = $inside.before(depth)
      const inner = textblockPositions(ancestor, ancestorPos)
      if (inner.length === 0 || !inner.every((pos) => selected.has(pos))) break
      bestPos = ancestorPos
      bestNode = ancestor
    }
    positions.push(bestPos)
    const end = bestPos + bestNode.nodeSize
    let removed = 0
    while (remaining.length > 0 && remaining[0] && remaining[0].pos >= bestPos && remaining[0].pos < end) {
      remaining.shift()
      removed += 1
    }
    if (removed === 0) remaining.shift()
  }
  return positions
}

const targetOf = (state: EditorState, pos: number, node: PMNode): BlockTarget => {
  const $pos = state.doc.resolve(pos)
  const isEmbed = node.type.name === 'embedBlock'
  const blockType = isEmbed && typeof node.attrs.blockType === 'string' ? node.attrs.blockType : node.type.name
  const props = isEmbed && isJsonObject(node.attrs.props) ? node.attrs.props : {}
  return {
    pos,
    node,
    nodeType: node.type.name,
    parentType: $pos.parent.type.name,
    blockType,
    isEmbed,
    props,
  }
}

/**
 * Resolves the current selection to a turn-into context, or null when conversions cannot apply:
 * an empty selection, or a selection whose first or last block is only partly covered while more
 * than one block is touched (offering only the middle would silently drop the edges).
 */
export const turnIntoSelectionContext = (state: EditorState): TurnIntoSelectionContext | null => {
  const { selection } = state
  const { from, to } = selection
  if (from === to) return null
  if (selection instanceof NodeSelection && selection.node.isBlock) {
    return { kind: 'whole', positions: [selection.from] }
  }
  const blocks = textblocksBetween(state, from, to)
  const first = blocks[0]
  const last = blocks[blocks.length - 1]
  if (!first || !last) return null
  if (blocks.length === 1 && !coversBlock(first, from, to)) {
    return {
      kind: 'partial',
      from,
      to,
      blockPos: first.pos,
      splitBefore: from > first.pos + 1,
      splitAfter: to < first.pos + first.node.nodeSize - 1,
    }
  }
  if (!coversBlock(first, from, to) || !coversBlock(last, from, to)) return null
  return { kind: 'whole', positions: promoteToBlocks(state, blocks) }
}

const fragmentIsPlainText = (state: EditorState, from: number, to: number): boolean => {
  let plain = true
  state.doc.nodesBetween(from, to, (node) => {
    if (node.isText && node.marks.length > 0) plain = false
    if (!node.isText && node.isInline) plain = false
    return plain
  })
  return plain
}

/**
 * Definitions compatible with every block in the context (intersection - never a silent per-block
 * subset). Partial contexts: chain conversions are fine (splits preserve surrounding marks and
 * structure); embed conversions additionally require the selected fragment to be plain unmarked
 * text, since only its text can be carried into the prop.
 */
export const turnIntoOptionsForSelection = (
  definitions: readonly TurnIntoDefinition[],
  state: EditorState,
  context: TurnIntoSelectionContext,
): readonly TurnIntoDefinition[] => {
  if (context.kind === 'partial') {
    const block = state.doc.nodeAt(context.blockPos)
    if (!block) return []
    const target = targetOf(state, context.blockPos, block)
    return definitions.filter((definition) => {
      if (!sourceMatches(definition.from, block.type.name)) return false
      if (definition.isCurrent?.(target)) return false
      if (definition.spec.kind === 'embed') return fragmentIsPlainText(state, context.from, context.to)
      return definition.accepts?.(target) ?? true
    })
  }
  const blocks = context.positions.map((pos) => ({ pos, node: state.doc.nodeAt(pos) }))
  if (blocks.some((block) => !block.node)) return []
  return definitions.filter((definition) =>
    blocks.every((block) => {
      const node = block.node
      if (!node) return false
      const target = targetOf(state, block.pos, node)
      return (
        sourceMatches(definition.from, node.type.name) &&
        (definition.accepts?.(target) ?? true) &&
        !(definition.isCurrent?.(target) ?? false)
      )
    }),
  )
}

/** Runs a conversion on the resolved context through the selection operations (one undo step). */
export const runTurnIntoOnSelection = (
  editor: Editor,
  definition: TurnIntoDefinition,
  context: TurnIntoSelectionContext,
): boolean => {
  if (context.kind === 'whole') return convertBlocksToSpec.run(editor, context.positions, definition.spec)
  return convertPartialSelectionToSpec.run(
    editor,
    context.from,
    context.to,
    context.blockPos,
    context.splitBefore,
    context.splitAfter,
    definition.spec,
  )
}

/** Plugin key of the block-selection plugin's state (marquee / Shift-click whole-block selection). */
export const BLOCK_SELECTION_PLUGIN_KEY = 'pageBlockSelection'

interface BlockSelectionPluginState {
  readonly anchor: number
  readonly head: number
  readonly scope?: number
}

/** The single PluginKey instance for that state; the block-selection plugin reuses this instance. */
export const blockSelectionPluginKey = new PluginKey<BlockSelectionPluginState | null>(BLOCK_SELECTION_PLUGIN_KEY)
const blockSelectionKey = blockSelectionPluginKey

/**
 * Top-level positions of the blocks in an active whole-block selection, or null when no block
 * selection is active (or it is scoped inside a nested container, which conversions don't cover).
 * Read through the plugin key, keeping the core independent of the block-selection plugin.
 */
export const selectedBlockPositions = (editor: Editor): readonly number[] | null => {
  const state = blockSelectionKey.getState(editor.state)
  if (!state || state.scope !== undefined) return null
  const positions: number[] = []
  let index = 0
  editor.state.doc.forEach((_node, pos) => {
    if (index >= Math.min(state.anchor, state.head) && index <= Math.max(state.anchor, state.head)) positions.push(pos)
    index += 1
  })
  return positions.length > 0 ? positions : null
}

/**
 * Handle-menu actions for a block inside an active multi-block selection: the "Turn into" entries
 * are filtered by intersection over ALL selected blocks and convert every selected block at once
 * (one undo step). Other actions pass through untouched.
 */
export const adaptBlockSelectionTurnInto = (
  editor: Editor,
  actions: readonly BlockAction[],
  definitions: readonly TurnIntoDefinition[],
  positions: readonly number[],
): readonly BlockAction[] => {
  const targets = positions.flatMap((pos) => {
    const node = editor.state.doc.nodeAt(pos)
    return node ? [targetOf(editor.state, pos, node)] : []
  })
  if (targets.length !== positions.length) return actions
  return actions.flatMap((action) => {
    if (action.section !== TURN_INTO_SECTION) return [action]
    const definition = definitions.find((d) => d.id === action.id)
    if (!definition || !definitionFitsTargets(definition, targets)) return []
    return [
      {
        ...action,
        run: () => {
          convertBlocksToSpec.run(editor, positions, definition.spec)
        },
      },
    ]
  })
}
