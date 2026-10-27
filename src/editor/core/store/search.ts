import type { PageStore } from './types'
import type { PageRegistry } from './registry'
import type { JsonObject } from '../json'

export interface SearchHit {
  /** Id of the block that contains the text, or null for a title match. */
  readonly blockId: string | null
  readonly excerpt: string
}

export interface PageSearchResult {
  readonly pageId: string
  readonly title: string
  /** Titles of the ancestors, top level first. */
  readonly path: readonly string[]
  readonly titleMatch: boolean
  readonly hits: readonly SearchHit[]
}

export interface SearchOptions {
  /** Most pages returned. Default 20. */
  readonly limit?: number
  /** Most hits kept per page. Default 5. */
  readonly hitsPerPage?: number
  /** Most pages read from the store in one search. Default 500; `truncated` says when it was reached. */
  readonly maxPages?: number
}

export interface PageSearchResponse {
  readonly results: readonly PageSearchResult[]
  /** True when the page limit stopped the walk, so some pages were not searched. */
  readonly truncated: boolean
}

/**
 * Lower case with accents removed, one output unit per input unit, so an index in the folded text is an index
 * in the original (needed for excerpts). Characters that fold to more than one unit keep their lower-case form.
 */
const fold = (text: string): string => {
  let out = ''
  for (const ch of text) {
    const base = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    out += base.length === ch.length ? base : ch.toLowerCase().padEnd(ch.length, ' ').slice(0, ch.length)
  }
  return out
}

interface DocNode {
  readonly type?: string
  readonly text?: string
  readonly attrs?: { readonly blockId?: unknown }
  readonly content?: readonly DocNode[]
}

/** Each textblock of a document with its block id: text nodes joined, in order. Inline atoms count as nothing. */
export function textBlocks(doc: JsonObject): { blockId: string | null; text: string }[] {
  const out: { blockId: string | null; text: string }[] = []
  const visit = (node: DocNode, inheritedId: string | null): void => {
    const own = typeof node.attrs?.blockId === 'string' ? node.attrs.blockId : null
    const id = own ?? inheritedId
    const children = node.content ?? []
    if (children.some((c) => c.type === 'text')) {
      // Inline content: text nodes joined, line breaks kept, inline atoms count as nothing.
      out.push({ blockId: id, text: children.map((c) => (c.type === 'hardBreak' ? '\n' : (c.text ?? ''))).join('') })
      return
    }
    for (const child of children) visit(child, id)
  }
  visit(doc as DocNode, null)
  return out
}

const excerptAround = (text: string, at: number, length: number): string => {
  const start = Math.max(0, at - 40)
  const piece = text.slice(start, at + length + 60).replace(/\s+/g, ' ')
  return (start > 0 ? '…' : '') + piece
}

/**
 * Searches live pages (not trashed) by title and body text, walking the page tree from the top. A page
 * whose body cannot be read is skipped, not reported as a match. Bodies are read one at a time, so memory
 * stays bounded for large page sets.
 */
export async function searchPages(
  sources: { readonly registry: PageRegistry; readonly pages: PageStore },
  query: string,
  options: SearchOptions = {},
): Promise<PageSearchResponse> {
  const { limit = 20, hitsPerPage = 5, maxPages = 500 } = options
  const needle = fold(query.trim())
  if (needle.length === 0) return { results: [], truncated: false }
  const results: PageSearchResult[] = []
  let visited = 0
  let truncated = false
  const walk = async (parentId: string | null, path: readonly string[]): Promise<void> => {
    for (const record of await sources.registry.children(parentId)) {
      if (results.length >= limit) return
      if (visited >= maxPages) {
        truncated = true
        return
      }
      visited += 1
      const titleMatch = fold(record.title).includes(needle)
      const hits: SearchHit[] = []
      try {
        const stored = await sources.pages.get(record.id)
        if (stored) {
          for (const block of textBlocks(stored.doc)) {
            const at = fold(block.text).indexOf(needle)
            if (at >= 0) {
              hits.push({ blockId: block.blockId, excerpt: excerptAround(block.text, at, needle.length) })
              if (hits.length >= hitsPerPage) break
            }
          }
        }
      } catch {
        // unreadable body: skip its text, the title can still match
      }
      if (titleMatch || hits.length > 0) {
        results.push({ pageId: record.id, title: record.title, path, titleMatch, hits })
      }
      await walk(record.id, [...path, record.title])
    }
  }
  await walk(null, [])
  return { results, truncated }
}
