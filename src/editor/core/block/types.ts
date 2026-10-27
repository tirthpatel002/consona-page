import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { ReactNode } from 'react'
import type { $ZodType } from 'zod/v4/core'
import type { JsonObject } from '../json'
import type { BlockPresentation } from './blockPresentation'

/** Descriptive metadata shown in menus. `type` is the stable id persisted in documents. */
export interface BlockMeta {
  readonly type: string
  readonly title: string
  readonly description?: string
  readonly icon?: string
  readonly keywords?: readonly string[]
}

/** A pure props transformation offered in the block's menu (e.g. "Stacked bars"). */
export interface BlockPropsAction<P> {
  readonly id: string
  readonly label: string | ((props: P) => string)
  readonly apply: (props: P) => P
  /**
   * A visual variant (callout style, and similar). Several style actions on one block collapse into
   * one "Styles" flyout; a single one stays a normal menu row.
   */
  readonly style?: boolean
}

/** Passed to `render`: lets interactive blocks (e.g. inline table editing) write back safely. */
export interface BlockRenderContext<P> {
  /** False when the editor is read-only; blocks should then render without editing affordances. */
  readonly editable: boolean
  /** Replaces the block's props in one undoable transaction. Returns false (and changes nothing) if invalid. */
  readonly update: (next: P) => boolean
  /** Node-selects this block and focuses the editor (e.g. after inline editing, so ⌘Z works). */
  readonly selectBlock: () => void
}

/**
 * Typed authoring contract for a block. `P` never escapes: `defineBlock` erases it
 * into a `BlockModule` whose boundaries are `unknown` in / `JsonObject` out.
 */
export interface BlockDefinition<P> extends BlockMeta {
  /** Editor chrome for hover / selection (default: inset on the embed body). */
  readonly presentation?: Partial<BlockPresentation>
  /**
   * Runtime validation of persisted props (any Zod 4 schema: classic or `zod/mini`).
   * Object schemas strip unknown keys.
   */
  readonly schema: $ZodType<P>
  /** Default props for a freshly inserted block. Must satisfy `schema`. */
  readonly template: () => P
  /** Render validated props (any React component). */
  readonly render: (props: P, context: BlockRenderContext<P>) => ReactNode
  readonly actions?: readonly BlockPropsAction<P>[]
}

/** What the node view provides to a validated block (type-erased side of BlockRenderContext). */
export interface BlockHost {
  readonly editable: boolean
  readonly updateProps: (props: JsonObject) => void
  readonly selectBlock: () => void
}

export type BlockValidation =
  | { readonly ok: true; readonly render: (host: BlockHost) => ReactNode }
  | { readonly ok: false; readonly issues: readonly string[] }

export interface ResolvedPropsAction {
  readonly id: string
  readonly label: string
  /** Returns the next props for the block. */
  readonly apply: () => JsonObject
  /** See `BlockPropsAction.style`. */
  readonly style?: boolean
}

/** Type-erased, registry-ready block. Produced by `defineBlock`. */
export interface BlockModule extends BlockMeta {
  readonly presentation: BlockPresentation
  createProps(): JsonObject
  validate(rawProps: unknown): BlockValidation
  actionsFor(rawProps: unknown): readonly ResolvedPropsAction[]
}

/** A top-level block of the document, as seen by the block (handle) menu. Any node type, not just embeds. */
export interface BlockTarget {
  /** Document position of the block node. */
  readonly pos: number
  readonly node: PMNode
  /** ProseMirror node type name, e.g. `paragraph`, `table`, `embedBlock`. */
  readonly nodeType: string
  /** Type name of the node that contains the block (e.g. `bulletList` for a list item). */
  readonly parentType?: string
  /** Registered block type for embedded blocks (`embedBlock` attrs.blockType); otherwise `nodeType`. */
  readonly blockType: string
  /** True for registry blocks rendered through the embed node (they have validated `props`). */
  readonly isEmbed: boolean
  /** Embedded block props (`{}` for other nodes). */
  readonly props: JsonObject
}

export interface BlockActionContext extends BlockTarget {
  readonly editor: Editor
  /** Opens a registered panel (e.g. the props editor). */
  readonly openPanel: (panelId: string) => void
}

/**
 * An action in the block menu (opened from the drag handle of any top-level block),
 * e.g. duplicate / delete / turn into. `section` groups actions under a label.
 */
export interface BlockAction {
  readonly id: string
  readonly label: string
  readonly danger?: boolean
  readonly section?: string
  /**
   * A visual variant (list marker, card tone, alignment, and similar). Several style actions on one
   * block collapse into one "Styles" flyout; a single one stays a normal menu row.
   */
  readonly style?: boolean
  readonly appliesTo?: (target: BlockTarget) => boolean
  readonly run: (context: BlockActionContext) => void
}
