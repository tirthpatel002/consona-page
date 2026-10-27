// Pure helpers for whole-block selection (positions are top-level block start positions).

export interface BlockSpan {
  readonly pos: number
  readonly end: number
}

/** Start/end of every top-level child of `doc`. */
export function blockSpans(doc: {
  forEach: (f: (node: { nodeSize: number }, offset: number) => void) => void
}): BlockSpan[] {
  const spans: BlockSpan[] = []
  doc.forEach((node, offset) => spans.push({ pos: offset, end: offset + node.nodeSize }))
  return spans
}

/** Index of the span containing document position `at`, or -1. */
export function spanIndexAt(spans: readonly BlockSpan[], at: number): number {
  return spans.findIndex((span) => at >= span.pos && at <= span.end)
}

export interface BlockSelectionState {
  /** Position of the container whose children are selected; absent for the top level. */
  readonly scope?: number
  /** Index where the selection started and the index that moves with Shift+Arrow. */
  readonly anchor: number
  readonly head: number
}

export type BlockKeyResult =
  { readonly kind: 'select'; readonly state: BlockSelectionState } | { readonly kind: 'none' }

/** Arrow handling: plain arrows move a single selected block, Shift extends from the anchor. */
export function moveBlockSelection(
  state: BlockSelectionState,
  key: 'ArrowUp' | 'ArrowDown',
  shift: boolean,
  count: number,
): BlockSelectionState {
  const delta = key === 'ArrowUp' ? -1 : 1
  const clamp = (value: number) => Math.max(0, Math.min(count - 1, value))
  if (shift) return { ...state, head: clamp(state.head + delta) }
  const lowest = Math.min(state.anchor, state.head)
  const highest = Math.max(state.anchor, state.head)
  const next = clamp(delta < 0 ? lowest + delta : highest + delta)
  return { scope: state.scope, anchor: next, head: next }
}

/** The document range covered by the selected blocks. */
export function selectedRange(
  spans: readonly BlockSpan[],
  state: BlockSelectionState,
): { from: number; to: number } | null {
  const first = spans[Math.min(state.anchor, state.head)]
  const last = spans[Math.max(state.anchor, state.head)]
  return first && last ? { from: first.pos, to: last.end } : null
}

export type ClientRect = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>

/** First and last block index whose boxes overlap the selection rectangle, or null when none do. */
export function spansInRect(rects: readonly ClientRect[], band: ClientRect): { first: number; last: number } | null {
  let first = -1
  let last = -1
  rects.forEach((rect, index) => {
    if (rect.bottom < band.top || rect.top > band.bottom) return
    if (rect.right < band.left || rect.left > band.right) return
    if (first < 0) first = index
    last = index
  })
  return first < 0 ? null : { first, last }
}
