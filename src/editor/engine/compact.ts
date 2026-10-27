import type { Node as PMNode } from '@tiptap/pm/model'
import { isBlockId } from '../core/blockId'

/**
 * What the engine needs from a Markdown converter. The host passes one in (the export plugin has one), so the
 * engine does not import plugins. All three work on plain document JSON.
 */
export interface MarkdownCodec {
  /** Inline Markdown to text nodes (with marks) and hard breaks. */
  parseInline(text: string): readonly JsonNode[]
  /** Block Markdown to top-level block nodes. */
  parseBlocks(text: string): readonly JsonNode[]
  /** Text nodes (with marks) back to inline Markdown. */
  inlineToMarkdown(content: readonly JsonNode[] | undefined): string
}

export interface JsonNode {
  readonly type: string
  readonly attrs?: Readonly<Record<string, unknown>>
  readonly content?: readonly JsonNode[]
  readonly marks?: readonly { readonly type: string; readonly attrs?: Readonly<Record<string, unknown>> }[]
  readonly text?: string
}

/** One line per block, one level of indent per nesting level: `[id] <text>` or `[id] ::type{attr=...} <text>`. */
const escapeLine = (text: string): string => text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')
export const unescapeLine = (text: string): string =>
  text.replace(/\\(\\|n)/g, (_, c: string) => (c === 'n' ? '\n' : '\\'))

const MAX_ATTR = 120

/** Attributes that differ from the node type's defaults, as `key=json`. Generated from the schema, so a new block type needs no code here. */
function directiveAttrs(node: PMNode): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(node.attrs)) {
    if (key === 'blockId') continue
    const spec = node.type.spec.attrs?.[key] as { default?: unknown } | undefined
    if (spec && JSON.stringify(spec.default ?? null) === JSON.stringify(value ?? null)) continue
    if (value === null || value === undefined) continue
    const json = JSON.stringify(value)
    parts.push(`${key}=${json.length > MAX_ATTR ? json.slice(0, MAX_ATTR) + '…"' : json}`)
  }
  return parts.length > 0 ? `{${parts.join(' ')}}` : ''
}

const listMarker = (parent: PMNode | null, node: PMNode): string => {
  if (node.type.name === 'taskItem') return `[${node.attrs.checked === true ? 'x' : ' '}] `
  return parent?.type.name === 'orderedList' ? '1. ' : '- '
}

/** The text of a block, as inline Markdown. A container shows the text of its first text block. */
function inlineOf(node: PMNode, codec: MarkdownCodec): string {
  const textblock = node.isTextblock ? node : firstTextblock(node)
  if (!textblock) return ''
  if (textblock.type.spec.code) return textblock.textContent
  return codec.inlineToMarkdown(textblock.toJSON().content as JsonNode[] | undefined)
}

const firstTextblock = (node: PMNode): PMNode | null => {
  let found: PMNode | null = null
  node.forEach((child) => {
    if (!found && child.isTextblock) found = child
  })
  return found
}

export interface CompactOptions {
  /** Longest line body kept; longer text is cut and the line ends with `…`. Default 2 000. */
  readonly maxChars?: number
  /** Most lines returned. Default 400. */
  readonly maxLines?: number
  /** Only these block ids (in page order). Default: the whole page. */
  readonly ids?: ReadonlySet<string>
}

export interface CompactText {
  readonly text: string
  readonly lines: number
  /** True when `maxLines` or `maxChars` cut something. */
  readonly truncated: boolean
}

/** Compact, id-addressed text of a page: standard Markdown for text blocks, one directive line for the rest. */
export function toCompact(doc: PMNode, codec: MarkdownCodec, options: CompactOptions = {}): CompactText {
  const { maxChars = 2_000, maxLines = 400, ids } = options
  const lines: string[] = []
  let truncated = false
  const visit = (node: PMNode, parent: PMNode | null, depth: number) => {
    const id = isBlockId(node.attrs.blockId) ? (node.attrs.blockId as string) : null
    if (id !== null && (!ids || ids.has(id))) {
      if (lines.length >= maxLines) {
        truncated = true
        return
      }
      const name = node.type.name
      let prefix: string
      if (name === 'paragraph') prefix = ''
      else if (name === 'heading') prefix = `${'#'.repeat(Number(node.attrs.level) || 1)} `
      else if (name === 'listItem' || name === 'taskItem') prefix = listMarker(parent, node)
      else if (name === 'codeBlock') prefix = `::codeBlock${directiveAttrs(node)} `
      else prefix = `::${name}${directiveAttrs(node)} `
      let body = escapeLine(inlineOf(node, codec))
      if (body.length > maxChars) {
        body = body.slice(0, maxChars) + '…'
        truncated = true
      }
      lines.push(`${'  '.repeat(depth)}[${id}] ${prefix}${body}`.trimEnd())
    }
    node.forEach((child) => {
      if (!child.isText) visit(child, node, id !== null ? depth + 1 : depth)
    })
  }
  doc.forEach((child) => visit(child, doc, 0))
  return { text: lines.join('\n'), lines: lines.length, truncated }
}
