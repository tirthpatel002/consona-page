// Pure ordering logic for "sort table by column". No ProseMirror here; unit-tested.

export type SortDirection = 'asc' | 'desc'

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** "420", "-3.5", "$1,250", "12%", "€ 9" → number; anything else (incl. empty) → null. */
export function parseNumeric(text: string): number | null {
  const cleaned = text
    .trim()
    .replace(/^[$€£¥]\s*/, '')
    .replace(/%$/, '')
    .replaceAll(',', '')
  if (cleaned === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(cleaned)) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/** Ascending comparison of two cell texts: numbers numerically (before text), text with a natural collator. */
export function compareCellText(a: string, b: string): number {
  const na = parseNumeric(a)
  const nb = parseNumeric(b)
  if (na !== null && nb !== null) return na - nb
  if (na !== null) return -1
  if (nb !== null) return 1
  return collator.compare(a.trim(), b.trim())
}

/**
 * Returns the new order of rows (indexes into `keys`) when sorting by those keys.
 * Stable; empty keys always sink to the bottom, whatever the direction.
 */
export function sortedRowOrder(keys: readonly string[], direction: SortDirection): number[] {
  const sign = direction === 'asc' ? 1 : -1
  return keys
    .map((key, index) => ({ key, index, empty: key.trim() === '' }))
    .sort((a, b) => {
      if (a.empty !== b.empty) return a.empty ? 1 : -1
      return a.empty ? 0 : sign * compareCellText(a.key, b.key)
    })
    .map(({ index }) => index)
}

export const isIdentityOrder = (order: readonly number[]): boolean => order.every((value, index) => value === index)
