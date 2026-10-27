import type { SlashItem } from './types'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Filters and ranks slash items for a query: title prefix > title word prefix >
 * keyword/group match > substring. Stable within a rank (registration order).
 */
export function filterSlashItems(items: readonly SlashItem[], query: string, limit = 50): SlashItem[] {
  const q = normalize(query)
  if (q === '') return items.slice(0, limit)

  const rank = (item: SlashItem): number => {
    const title = normalize(item.title)
    if (title.startsWith(q)) return 0
    if (title.split(' ').some((word) => word.startsWith(q))) return 1
    const extra = [...(item.keywords ?? []), item.group].map(normalize)
    if (extra.some((word) => word.startsWith(q))) return 2
    if (title.includes(q) || extra.some((word) => word.includes(q))) return 3
    return -1
  }

  return items
    .map((item, index) => ({ item, index, score: rank(item) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item)
}
