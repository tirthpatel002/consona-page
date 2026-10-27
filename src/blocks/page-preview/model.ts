import type { JsonObject, PageListRegistry, PageStore } from '../../editor/core'

export interface PreviewNode {
  readonly type: string
  readonly text?: string
  readonly attrs?: Readonly<Record<string, unknown>>
  readonly marks?: readonly { type: string }[]
  readonly content?: readonly PreviewNode[]
}

/** A bounded render model, never persisted or used as a second editable body. */
export function previewNodes(doc: JsonObject): readonly PreviewNode[] {
  let budget = 120
  let chars = 4000
  const copy = (raw: unknown, depth: number): PreviewNode | null => {
    if (!raw || typeof raw !== 'object' || depth > 8 || budget-- <= 0 || chars <= 0) return null
    const n = raw as Record<string, unknown>
    const text = typeof n.text === 'string' ? n.text.slice(0, Math.max(0, chars)) : undefined
    chars -= text?.length ?? 0
    return {
      type: typeof n.type === 'string' ? n.type : 'unknown',
      text,
      attrs: n.attrs && typeof n.attrs === 'object' ? (n.attrs as Record<string, unknown>) : undefined,
      marks: Array.isArray(n.marks)
        ? n.marks
            .slice(0, 12)
            .filter((m): m is { type: string } => !!m && typeof m === 'object' && typeof m.type === 'string')
            .map((m) => ({ type: m.type }))
        : undefined,
      content: Array.isArray(n.content)
        ? n.content
            .slice(0, 30)
            .map((c) => copy(c, depth + 1))
            .filter((c): c is PreviewNode => !!c)
        : undefined,
    }
  }
  const content = doc.content
  return Array.isArray(content)
    ? content
        .slice(0, 12)
        .map((n) => copy(n, 0))
        .filter((n): n is PreviewNode => !!n)
    : []
}

export type PreviewState =
  | { readonly status: 'ready'; readonly title: string; readonly nodes: readonly PreviewNode[] }
  | { readonly status: 'missing' | 'trashed' | 'cycle' }

/** Resolve references through the authoritative stores. A hidden ancestor hides its descendants too. */
export async function readPreview(
  registry: PageListRegistry,
  pages: PageStore,
  pageId: string,
  parentId?: string,
): Promise<PreviewState> {
  if (parentId === pageId) return { status: 'cycle' }
  const record = await registry.get(pageId)
  if (!record) return { status: 'missing' }
  const path = await registry.path(pageId)
  if (parentId && path.some((p) => p.id === pageId)) return { status: 'cycle' }
  if (record.trashedAt !== null || path.some((p) => p.trashedAt !== null)) return { status: 'trashed' }
  const saved = await pages.get(pageId)
  return { status: 'ready', title: record.title || 'Untitled', nodes: saved ? previewNodes(saved.doc) : [] }
}
