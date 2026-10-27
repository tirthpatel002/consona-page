/**
 * Class the block puts on its outermost rendered element when `presentation.feedback` is `shell`.
 * Marquee / node selection classes are applied on the ProseMirror node-view root (see blockNode.ts),
 * not on NodeViewWrapper — shell feedback must live on this element.
 */
export const PAGE_BLOCK_SHELL_CLASS = 'page-block__shell'

/** Where hover / block-selection feedback is painted for embed blocks. */
export type BlockFeedbackTarget = 'inset' | 'shell'

export interface BlockPresentation {
  /**
   * - `inset` — fill + ring on `.page-block__body` (equations, breadcrumbs, …).
   * - `shell` — fill + ring on the block root (`.page-block__shell`); must match the component’s border-radius.
   */
  readonly feedback: BlockFeedbackTarget
}

export const DEFAULT_BLOCK_PRESENTATION: BlockPresentation = { feedback: 'inset' }

export function resolveBlockPresentation(presentation?: Partial<BlockPresentation>): BlockPresentation {
  return { feedback: presentation?.feedback ?? DEFAULT_BLOCK_PRESENTATION.feedback }
}

/** Top-level native nodes (card, table) that own their own shell. */
export const NATIVE_SHELL_FEEDBACK = 'shell' as const
