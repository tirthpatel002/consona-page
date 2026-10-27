import { Fragment, type Node as PMNode, type NodeType, type Schema } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'

/** What a chain-style "Turn into" builds when the source is not a plain paragraph or heading. */
export type TurnIntoShape =
  | { readonly type: 'paragraph' }
  | { readonly type: 'heading'; readonly level: 1 | 2 | 3 }
  | { readonly type: 'bulletList' }
  | { readonly type: 'orderedList' }
  | { readonly type: 'taskList' }
  | { readonly type: 'blockquote' }
  | { readonly type: 'codeBlock' }

const stringProp = (value: unknown): string => (typeof value === 'string' ? value : '')

const joinParts = (...parts: readonly string[]): string => parts.filter((part) => part.length > 0).join('\n')

/** Plain text carried out of an embed, including every text prop the block actually stores. */
const embedPlainText = (node: PMNode): string => {
  const props = node.attrs.props
  if (typeof props !== 'object' || props === null) return ''
  const record = props as Record<string, unknown>
  switch (node.attrs.blockType) {
    case 'callout':
      return joinParts(stringProp(record.title), stringProp(record.body))
    case 'equation':
      return stringProp(record.latex)
    case 'mermaid':
      return stringProp(record.source)
    case 'toggle':
      return joinParts(stringProp(record.title), stringProp(record.body))
    case 'breadcrumb': {
      const items = Array.isArray(record.items) ? record.items : []
      return items
        .map((item) => stringProp((item as { label?: unknown }).label))
        .filter((label) => label.length > 0)
        .join('\n')
    }
    case 'tabs': {
      const tabs = Array.isArray(record.tabs) ? record.tabs : []
      return tabs
        .map((tab) => {
          const entry = tab as { title?: unknown; body?: unknown }
          return joinParts(stringProp(entry.title), stringProp(entry.body))
        })
        .filter((part) => part.length > 0)
        .join('\n')
    }
    default:
      return Object.values(record)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join('\n')
  }
}

/** Text a conversion can carry: inline text for textblocks, one line per nested textblock, props for embeds. */
export const blockPlainText = (node: PMNode): string => {
  if (node.type.name === 'embedBlock') return embedPlainText(node)
  if (node.isTextblock) return node.textContent
  const lines: string[] = []
  node.descendants((child) => {
    if (child.isTextblock) {
      lines.push(child.textContent)
      return false
    }
    return true
  })
  return lines.join('\n')
}

const textToFragments = (schema: Schema, text: string): Fragment[] => {
  if (text.length === 0) return [Fragment.empty]
  return text.split('\n').map((line) => (line.length > 0 ? Fragment.from(schema.text(line)) : Fragment.empty))
}

const linesOf = (schema: Schema, block: PMNode): Fragment[] =>
  block.textContent.includes('\n') ? textToFragments(schema, block.textContent) : [block.content]

/** One fragment per line of content, marks kept when the source has no hard newlines. */
const sourceLines = (schema: Schema, node: PMNode): Fragment[] => {
  if (node.type.name === 'embedBlock') return textToFragments(schema, embedPlainText(node))
  const blocks: PMNode[] = []
  if (node.isTextblock) blocks.push(node)
  else {
    node.descendants((child) => {
      if (child.isTextblock) {
        blocks.push(child)
        return false
      }
      return true
    })
  }
  if (blocks.length === 0) return [Fragment.empty]
  return blocks.flatMap((block) => linesOf(schema, block))
}

const createBlock = (
  type: NodeType,
  attrs: Record<string, unknown> | null,
  content?: Fragment | PMNode | readonly PMNode[],
): PMNode => {
  const node = type.createAndFill(attrs, content as Fragment | PMNode | PMNode[] | undefined)
  if (!node) throw new Error(`Cannot create ${type.name}`)
  return node
}

const paragraphFrom = (schema: Schema, content: Fragment): PMNode => {
  try {
    return createBlock(schema.nodes.paragraph, null, content)
  } catch {
    const text = content.textBetween(0, content.size, '')
    return createBlock(schema.nodes.paragraph, null, text.length > 0 ? schema.text(text) : undefined)
  }
}

const headingFrom = (schema: Schema, level: 1 | 2 | 3, content: Fragment): PMNode => {
  try {
    return createBlock(schema.nodes.heading, { level }, content)
  } catch {
    const text = content.textBetween(0, content.size, '')
    return createBlock(schema.nodes.heading, { level }, text.length > 0 ? schema.text(text) : undefined)
  }
}

/** Blocks that replace `source` for a Turn into shape. One line of the source becomes one block, except code (joined). */
export const nodesForShape = (schema: Schema, shape: TurnIntoShape, source: PMNode): readonly PMNode[] => {
  const lines = sourceLines(schema, source)
  if (shape.type === 'paragraph') return lines.map((line) => paragraphFrom(schema, line))
  if (shape.type === 'heading') return lines.map((line) => headingFrom(schema, shape.level, line))
  if (shape.type === 'codeBlock') {
    const text = lines.map((line) => line.textBetween(0, line.size, '')).join('\n')
    return [createBlock(schema.nodes.codeBlock, null, text.length > 0 ? schema.text(text) : undefined)]
  }
  if (shape.type === 'blockquote') {
    return [
      createBlock(
        schema.nodes.blockquote,
        null,
        lines.map((line) => paragraphFrom(schema, line)),
      ),
    ]
  }
  const listName =
    shape.type === 'bulletList' ? 'bulletList' : shape.type === 'orderedList' ? 'orderedList' : 'taskList'
  const itemName = shape.type === 'taskList' ? 'taskItem' : 'listItem'
  const itemAttrs = shape.type === 'taskList' ? { checked: false } : null
  const items = lines.map((line) => createBlock(schema.nodes[itemName], itemAttrs, paragraphFrom(schema, line)))
  return [createBlock(schema.nodes[listName], null, items)]
}

interface PlannedReplacement {
  readonly from: number
  readonly to: number
  readonly nodes: readonly PMNode[]
}

/**
 * Where `nodes` can land in place of the block at `pos`. If the parent cannot hold them (a paragraph
 * where a list item was), the parent is split around the block and the search walks outward.
 */
const planReplacement = (doc: PMNode, pos: number, nodes: readonly PMNode[]): PlannedReplacement | null => {
  if (nodes.length === 0) return null
  let rangeFrom = pos
  let target = doc.nodeAt(pos)
  if (!target) return null
  let pieces: PMNode[] = [...nodes]
  for (let guard = 0; guard < 12; guard += 1) {
    const $pos = doc.resolve(rangeFrom)
    const fragment = Fragment.from(pieces)
    if ($pos.parent.canReplace($pos.index(), $pos.index() + 1, fragment)) {
      return { from: rangeFrom, to: rangeFrom + target.nodeSize, nodes: pieces }
    }
    if ($pos.depth === 0) return null
    const parent = $pos.parent
    const before = parent.content.cut(0, $pos.parentOffset)
    const after = parent.content.cut($pos.parentOffset + target.nodeSize)
    try {
      const next: PMNode[] = []
      if (before.size > 0) next.push(parent.type.create(parent.attrs, before))
      next.push(...pieces)
      if (after.size > 0) next.push(parent.type.create(parent.attrs, after))
      pieces = next
    } catch {
      return null
    }
    target = parent
    rangeFrom = $pos.before()
  }
  return null
}

/** Replaces the block at `pos` with `nodes`, splitting an unfit parent (list, column, table) around it. */
export const replaceBlockAt = (tr: Transaction, pos: number, nodes: readonly PMNode[]): boolean => {
  const planned = planReplacement(tr.doc, pos, nodes)
  if (!planned) return false
  tr.replaceWith(planned.from, planned.to, Fragment.from(planned.nodes))
  return true
}

/** True when `nodes` could replace the block at `pos` without dispatching. */
export const canReplaceBlockAt = (doc: PMNode, pos: number, nodes: readonly PMNode[]): boolean =>
  planReplacement(doc, pos, nodes) !== null
