import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { convertBlocksToSpec, type TurnIntoSpec } from '../operations/operations'
import type { BlockAction, BlockModule, BlockTarget } from './types'

/** The block-menu section every "Turn into" conversion is grouped under. */
export const TURN_INTO_SECTION = 'Turn into'

/** Node types whose marks a text-to-prop conversion refuses to flatten. */
export const TEXT_SOURCE_TYPES: readonly string[] = ['paragraph', 'heading']

/** `from` entry that accepts every block except ones with nothing to carry (a divider). */
export const ANY_BLOCK_SOURCE = '*'

const NON_CONVERTIBLE = new Set(['horizontalRule'])

/** True when `nodeType` is a source this conversion lists (`'*'` means any block that has content). */
export const sourceMatches = (from: readonly string[], nodeType: string): boolean =>
  !NON_CONVERTIBLE.has(nodeType) && (from.includes(ANY_BLOCK_SOURCE) || from.includes(nodeType))

export interface TurnIntoContext {
  readonly editor: Editor
  readonly pos: number
  readonly node: PMNode
  /** Plain-text content of the source block. Conversions should preserve it, not drop it. */
  readonly text: string
}

/**
 * One registered "Turn into" conversion (D2). Any plugin can contribute conversions for its own
 * block types; the registry adapts them into block-menu actions in the shared section.
 */
export interface TurnIntoDefinition {
  /** Stable id, prefixed by the owning plugin (e.g. `text:turn-into-heading-1`). */
  readonly id: string
  /** Menu label, e.g. `Heading 1`. */
  readonly label: string
  /** Node type or block type this conversion produces (drives the compatibility registry). */
  readonly target: string
  /** Source block node types the conversion accepts. */
  readonly from: readonly string[]
  /** Hide the entry when the block already has this shape. */
  readonly isCurrent?: (target: BlockTarget) => boolean
  /**
   * Extra acceptance rule beyond `from`, e.g. rejecting sources whose content the conversion could not
   * preserve (a text-to-prop embed conversion rejects marked or non-text inline content rather than
   * silently flattening it).
   */
  readonly accepts?: (target: BlockTarget) => boolean
  readonly convert: (context: TurnIntoContext) => void
  /**
   * How the conversion applies to one block, in a form selection-context entry points (text selection,
   * multi-block selection) can run through the selection operations. Every definition should carry one.
   */
  readonly spec: TurnIntoSpec
}

/**
 * Compatibility registry (D2): every registered embed block must either offer a conversion that
 * carries the source text into one of its props, or be listed here with the reason a conversion
 * would be unsafe or meaningless. A registry test asserts full coverage, so a new block has to
 * make the decision explicitly instead of silently being non-convertible.
 */
export const TURN_INTO_UNSUPPORTED: Readonly<Record<string, string>> = {
  breadcrumb:
    'items are structured {label, href} links; plain text has no meaningful mapping and a guessed href could send the wrong destination',
  tabs: 'tabs are structured titled panels; plain text has no meaningful mapping',
}

/** True when a conversion accepts every one of `targets` (intersection - never a silent subset). */
export const definitionFitsTargets = (definition: TurnIntoDefinition, targets: readonly BlockTarget[]): boolean =>
  targets.every(
    (target) =>
      sourceMatches(definition.from, target.nodeType) &&
      (definition.accepts?.(target) ?? true) &&
      !(definition.isCurrent?.(target) ?? false),
  )

/** Adapts a registered conversion to a block-menu action in the shared "Turn into" section. */
export const turnIntoAction = (definition: TurnIntoDefinition): BlockAction => ({
  id: definition.id,
  label: definition.label,
  section: TURN_INTO_SECTION,
  appliesTo: (target) =>
    sourceMatches(definition.from, target.nodeType) &&
    !(definition.isCurrent?.(target) ?? false) &&
    (definition.accepts?.(target) ?? true),
  run: ({ editor, pos, node }) => definition.convert({ editor, pos, node, text: node.textContent }),
})

/** True when a block's inline content is plain unmarked text - the only content a text prop can hold loss-free. */
const isPlainInlineText = (node: PMNode): boolean => {
  let plain = true
  node.forEach((child) => {
    if (!child.isText || child.marks.length > 0) plain = false
  })
  return plain
}

/**
 * Turns a text block into an embed block, carrying its text into one text prop of the block
 * (e.g. an equation's `latex` or a mermaid diagram's `source`), as one undoable step.
 * Only offered for plain unmarked text: marks, links, hard breaks or inline atoms would be silently
 * flattened into the prop, so the compatibility rule rejects those sources instead.
 */
export const turnIntoEmbed = (block: BlockModule, prop: string): TurnIntoDefinition => {
  const spec: TurnIntoSpec = {
    kind: 'embed',
    blockType: block.type,
    makeProps: (text) => ({ ...block.createProps(), [prop]: text }),
  }
  return {
    id: `block:${block.type}:turn-into`,
    label: block.title,
    target: block.type,
    from: [ANY_BLOCK_SOURCE],
    isCurrent: (target) => target.isEmbed && target.blockType === block.type,
    // Marks survive a chain conversion. A text prop cannot hold them, so a marked paragraph or
    // heading is refused instead of being flattened. Other blocks already store plain text.
    accepts: (target) => (TEXT_SOURCE_TYPES.includes(target.nodeType) ? isPlainInlineText(target.node) : true),
    convert: ({ editor, pos }) => {
      convertBlocksToSpec.run(editor, [pos], spec)
    },
    spec,
  }
}
