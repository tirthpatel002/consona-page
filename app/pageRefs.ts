import type { JSONContent } from '@tiptap/core'

/** Ids of pages the body already links with a page-reference block, at any depth. */
export function collectPageReferenceIds(doc: JSONContent): ReadonlySet<string> {
  const ids = new Set<string>()
  const walk = (node: JSONContent) => {
    if (node.type === 'embedBlock' && node.attrs?.blockType === 'pageReference') {
      const id = (node.attrs.props as { pageId?: unknown } | undefined)?.pageId
      if (typeof id === 'string' && id) ids.add(id)
    }
    for (const child of node.content ?? []) walk(child)
  }
  walk(doc)
  return ids
}
