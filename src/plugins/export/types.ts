/** TipTap / ProseMirror document JSON shapes (only what the converters need). */

export interface DocMark {
  readonly type: string
  readonly attrs?: Readonly<Record<string, unknown>>
}

export interface DocNode {
  readonly type: string
  readonly attrs?: Readonly<Record<string, unknown>>
  readonly content?: readonly DocNode[]
  readonly marks?: readonly DocMark[]
  readonly text?: string
}

export interface Doc {
  readonly type: 'doc'
  readonly content?: readonly DocNode[]
}

/** Inline containers whose children concatenate without separators. */
const INLINE_CONTAINERS: ReadonlySet<string> = new Set([
  'doc',
  'paragraph',
  'heading',
  'tableCell',
  'tableHeader',
  'detailsSummary',
  'listItem',
  'taskItem',
  'codeBlock',
  'media',
])

/** Plain text of a node subtree; block boundaries become newlines. */
export function textOf(node: DocNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  const parts = (node.content ?? []).map(textOf)
  if (INLINE_CONTAINERS.has(node.type)) return parts.join('')
  return parts.filter(Boolean).join('\n')
}

/** Reads a string attribute when present and non-empty. */
export function stringAttr(node: DocNode, name: string): string | null {
  const value = node.attrs?.[name]
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Reads a number attribute when present. */
export function numberAttr(node: DocNode, name: string): number | null {
  const value = node.attrs?.[name]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
