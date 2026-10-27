import type { ChainedCommands, JSONContent } from '@tiptap/core'
import type { Node as PMNode, Schema } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'
import { Transform } from '@tiptap/pm/transform'
import type { JsonObject } from '../json'
import { BLOCK_NODE_NAME } from '../block/blockNodeOptions'
import { blockPlainText, canReplaceBlockAt, replaceBlockAt } from '../block/turnIntoContent'
import { defineOperation } from './defineOperation'

/** Transaction meta `{ from, to }` set when whole blocks are removed, so layout plugins can tidy up what they leave behind. */
export const BLOCK_REMOVAL_META = 'pageBlockRemoval'

/** Core operations. Feature plugins define their own with `defineOperation`. */
export const insertBlock = defineOperation('insertBlock', (chain, type: string) => chain.insertBlock(type))

export const setMark = defineOperation('setMark', (chain, mark: string, attrs?: Record<string, unknown>) =>
  chain.setMark(mark, attrs),
)

export const unsetMark = defineOperation('unsetMark', (chain, mark: string) => chain.unsetMark(mark))

export const toggleMark = defineOperation('toggleMark', (chain, mark: string) => chain.toggleMark(mark))

export const setLink = defineOperation('setLink', (chain, href: string) =>
  chain.extendMarkRange('link').setMark('link', { href }),
)

export const unsetLink = defineOperation('unsetLink', (chain) => chain.extendMarkRange('link').unsetMark('link'))

/** Replaces the props of the block at `pos` (validated by the block's schema) as one undoable step. */
export const updateBlockProps = defineOperation('updateBlockProps', (chain, pos: number, props: JsonObject) =>
  chain.updateBlockProps(pos, props),
)

/** Deletes `[from, to)` (e.g. a whole block). */
export const deleteRange = defineOperation('deleteRange', (chain, from: number, to: number) =>
  chain
    .command(({ tr }) => {
      tr.setMeta(BLOCK_REMOVAL_META, { from, to })
      return true
    })
    .deleteRange({ from, to }),
)

/** Inserts JSON content at `pos`. */
export const insertContentAt = defineOperation('insertContentAt', (chain, pos: number, content: JsonObject) =>
  chain.insertContentAt(pos, content),
)

/**
 * Moves the blocks in `[from, to)` so they sit at position `before` (a block boundary; null = at the end of the document)
 * and selects the first of them. One undo step.
 */
export const moveBlocksTo = defineOperation('moveBlocksTo', (chain, from: number, to: number, before: number | null) =>
  chain.command(({ tr, dispatch }) => {
    if (to <= from || to > tr.doc.content.size) return false
    const target = before ?? tr.doc.content.size
    if (target >= from && target <= to) return false
    // Refuse moves the schema would not accept at the destination (e.g. a list item dropped between top-level blocks).
    const scratch = new Transform(tr.doc).delete(from, to)
    const insertPos = scratch.mapping.map(target)
    const $insert = scratch.doc.resolve(insertPos)
    if (!$insert.parent.canReplace($insert.index(), $insert.index(), tr.doc.slice(from, to).content)) return false
    if (dispatch) {
      tr.setMeta(BLOCK_REMOVAL_META, { from, to })
      const content = tr.doc.slice(from, to).content
      tr.delete(from, to)
      const insertAt = tr.mapping.map(target)
      tr.insert(insertAt, content)
      tr.setSelection(NodeSelection.create(tr.doc, insertAt))
    }
    return true
  }),
)

export const undo = defineOperation('undo', (chain) => chain.undo())

export const redo = defineOperation('redo', (chain) => chain.redo())

/**
 * How a "Turn into" conversion is applied to a block (D2). `chain` builds the target blocks from the
 * source (text, heading, list, quote, code), lifting them out of a parent that cannot hold them.
 * `embed` replaces the block with an embed whose props carry the source's plain text.
 */
export type TurnIntoSpec =
  | {
      readonly kind: 'chain'
      readonly blocks: (schema: Schema, source: PMNode) => readonly PMNode[]
    }
  | { readonly kind: 'embed'; readonly blockType: string; readonly makeProps: (text: string) => JsonObject }

const blocksFor = (schema: Schema, node: PMNode, spec: TurnIntoSpec): readonly PMNode[] | null => {
  if (spec.kind === 'chain') return spec.blocks(schema, node)
  const type = schema.nodes[BLOCK_NODE_NAME]
  if (!type) return null
  const embed = type.create({ blockType: spec.blockType, props: spec.makeProps(blockPlainText(node)) })
  return [embed]
}

const applySpecAt = (chain: ChainedCommands, pos: number, spec: TurnIntoSpec): ChainedCommands =>
  chain.command(({ state, tr, dispatch }) => {
    const node = state.doc.nodeAt(pos)
    if (!node) return false
    let built: readonly PMNode[]
    try {
      const next = blocksFor(state.schema, node, spec)
      if (!next || next.length === 0) return false
      built = next
    } catch {
      return false
    }
    if (!canReplaceBlockAt(state.doc, pos, built)) return false
    if (dispatch) return replaceBlockAt(tr, pos, built)
    return true
  })

/**
 * Converts the whole blocks at `positions` (top-level, processed bottom-up so earlier conversions
 * cannot move later ones) with one spec, as a single undoable transaction (D2).
 */
export const convertBlocksToSpec = defineOperation(
  'convertBlocksToSpec',
  (chain, positions: readonly number[], spec: TurnIntoSpec) => {
    let next = chain
    for (const pos of [...positions].sort((a, b) => b - a)) next = applySpecAt(next, pos, spec)
    return next
  },
)

/**
 * Converts a partial selection inside one text block: splits the block around [from, to] when the
 * selection does not already reach an edge (the surrounding parts keep their content and marks
 * untouched - the split only adds boundaries), then converts the extracted middle block with `spec`.
 * One undoable transaction (D2). `blockPos` is the position of the containing top-level block, and
 * `splitBefore` / `splitAfter` say whether the selection starts/ends strictly inside it.
 */
export const convertPartialSelectionToSpec = defineOperation(
  'convertPartialSelectionToSpec',
  (
    chain,
    from: number,
    to: number,
    blockPos: number,
    splitBefore: boolean,
    splitAfter: boolean,
    spec: TurnIntoSpec,
  ) => {
    let next = chain
    if (splitAfter) next = next.setTextSelection(to).splitBlock()
    if (splitBefore) next = next.setTextSelection(from).splitBlock()
    // After a split at content position `from`, the new block starts one position later.
    const middlePos = splitBefore ? from + 1 : blockPos
    return applySpecAt(next, middlePos, spec)
  },
)

/** Replaces the whole document with a saved version (E3 restore). One undo step. */
export const restoreVersion = defineOperation('restoreVersion', (chain, doc: JSONContent) =>
  // Emit the update so listeners (autosave, comments) see the restored document, not only the screen.
  chain.setContent(doc, { emitUpdate: true }),
)
