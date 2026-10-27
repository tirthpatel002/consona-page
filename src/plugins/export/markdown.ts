import { asKind, embedOriginal, isSafeMediaSrc } from '../media/sources'
import { numberAttr, stringAttr, textOf, type Doc, type DocMark, type DocNode } from './types'

/**
 * Markdown <-> TipTap JSON. Markdown has no columns, toggles, callouts, embeds or coloured text;
 * those export with a documented lossy fallback (see README) and never lose their text.
 */

const ESCAPABLE = /([\\`*_[\]<>])/g

function escapeText(text: string): string {
  return text.replace(ESCAPABLE, '\\$1')
}

function unescapeText(text: string): string {
  return text.replace(/\\([\\`*_[\]<>])/g, '$1')
}

function markType(marks: readonly DocMark[], type: string): DocMark | undefined {
  return marks.find((mark) => mark.type === type)
}

/** Serializes inline content (text, marks, hard breaks) to Markdown. */
export function inlineToMarkdown(content: readonly DocNode[] | undefined): string {
  return (content ?? [])
    .map((node) => {
      if (node.type === 'hardBreak') return '  \n'
      if (node.type !== 'text') return textOf(node)
      const text = node.text ?? ''
      const marks = node.marks ?? []
      let out: string
      if (markType(marks, 'code')) {
        // Inline code cannot carry other marks; backticks inside are escaped.
        out = `\`${text.replace(/`/g, '\\`')}\``
      } else {
        out = escapeText(text)
        if (markType(marks, 'bold')) out = `**${out}**`
        if (markType(marks, 'italic')) out = `*${out}*`
        if (markType(marks, 'strike')) out = `~~${out}~~`
        if (markType(marks, 'underline')) out = `<u>${out}</u>`
        // textStyle (colour / highlight) is intentionally dropped: Markdown has no equivalent.
      }
      const href = stringAttr({ type: 'text', attrs: markType(marks, 'link')?.attrs }, 'href')
      if (href) out = `[${out}](${href})`
      return out
    })
    .join('')
}

function fenceFor(code: string): string {
  const runs = code.match(/`+/g) ?? []
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 2)
  return '`'.repeat(longest + 1)
}

function listToMarkdown(list: DocNode, indent: string, lines: string[]): void {
  const ordered = list.type === 'orderedList'
  const task = list.type === 'taskList'
  ;(list.content ?? []).forEach((item, index) => {
    const marker = task ? `- [${item.attrs?.checked === true ? 'x' : ' '}] ` : ordered ? `${index + 1}. ` : '- '
    let first = true
    for (const child of item.content ?? []) {
      if (child.type === 'paragraph' || child.type === 'heading') {
        lines.push(`${indent}${first ? marker : '  '}${inlineToMarkdown(child.content)}`)
      } else if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
        listToMarkdown(child, `${indent}  `, lines)
      } else {
        lines.push(...blockToMarkdown(child).map((line) => `${indent}  ${line}`))
      }
      first = false
    }
  })
}

function tableToMarkdown(table: DocNode, lines: string[]): void {
  const rows = table.content ?? []
  const cellsOf = (row: DocNode | undefined): string[] =>
    (row?.content ?? []).map((cell) =>
      inlineToMarkdown(cell.content?.[0]?.content).replace(/\|/g, '\\|').replace(/\n/g, ' '),
    )
  // GFM needs a header row: the first row is always emitted as the header. Colspan/rowspan are lost.
  lines.push(`| ${cellsOf(rows[0]).join(' | ')} |`)
  lines.push(`| ${(rows[0]?.content ?? []).map(() => '---').join(' | ')} |`)
  for (const row of rows.slice(1)) lines.push(`| ${cellsOf(row).join(' | ')} |`)
}

function calloutLines(node: DocNode): string[] {
  const props = node.attrs?.props
  const record = typeof props === 'object' && props !== null ? (props as Record<string, unknown>) : {}
  const title = typeof record.title === 'string' ? record.title : ''
  const body = typeof record.body === 'string' ? record.body : ''
  const lines: string[] = []
  if (title) lines.push(`> **${escapeText(title)}**`)
  if (body) lines.push(...body.split('\n').map((line) => `> ${escapeText(line)}`))
  if (lines.length === 0) lines.push(`> [${node.attrs?.blockType ?? 'embed'} block]`)
  return lines
}

/** Serializes one block node to Markdown lines. Unknown nodes keep at least their text. */
export function blockToMarkdown(node: DocNode): string[] {
  switch (node.type) {
    case 'paragraph':
      return [inlineToMarkdown(node.content)]
    case 'heading': {
      const level = Math.min(Math.max(numberAttr(node, 'level') ?? 1, 1), 6)
      return [`${'#'.repeat(level)} ${inlineToMarkdown(node.content)}`]
    }
    case 'bulletList':
    case 'orderedList':
    case 'taskList': {
      const lines: string[] = []
      listToMarkdown(node, '', lines)
      return lines
    }
    case 'blockquote': {
      const inner = (node.content ?? []).flatMap(blockToMarkdown)
      return inner.length > 0 ? inner.map((line) => (line ? `> ${line}` : '>')) : ['>']
    }
    case 'codeBlock': {
      const code = (node.content ?? []).map((child) => child.text ?? '').join('')
      const fence = fenceFor(code)
      return [`${fence}${stringAttr(node, 'language') ?? ''}`, ...code.split('\n'), fence]
    }
    case 'horizontalRule':
      return ['---']
    case 'details': {
      const summary = node.content?.find((child) => child.type === 'detailsSummary')
      const content = node.content?.find((child) => child.type === 'detailsContent')
      // Lossy: the toggle becomes a bold summary line followed by its content.
      return [`**▸ ${inlineToMarkdown(summary?.content)}**`, ...(content?.content ?? []).flatMap(blockToMarkdown)]
    }
    case 'table': {
      const lines: string[] = []
      tableToMarkdown(node, lines)
      return lines
    }
    case 'columnList':
    case 'column':
    case 'card':
      // Lossy: layout containers flatten to a top-to-bottom sequence.
      return (node.content ?? []).flatMap(blockToMarkdown)
    case 'embedBlock':
      return calloutLines(node)
    case 'media': {
      const kind = asKind(stringAttr(node, 'kind'))
      const rawSrc = stringAttr(node, 'src') ?? ''
      const src = isSafeMediaSrc(kind, rawSrc) ? rawSrc : ''
      const alt = stringAttr(node, 'alt') ?? ''
      const showCaption = (node.attrs as { showCaption?: unknown } | undefined)?.showCaption !== false
      const caption = showCaption ? textOf({ type: 'media', content: node.content }) : ''
      const escapeAttr = (value: string) => value.replace(/["<>&]/g, (c) => encodeURIComponent(c))
      if (kind === 'video') return [`<video src="${escapeAttr(src)}">${escapeText(caption)}</video>`]
      if (kind === 'audio') return [`<audio src="${escapeAttr(src)}">${escapeText(caption)}</audio>`]
      if (kind === 'embed') {
        const page = embedOriginal(src)
        return page ? [`[${escapeText(caption || 'Video')}](${page})`] : []
      }
      if (kind === 'file') {
        const name = (stringAttr(node, 'name') ?? '').replace(/[[\]]/g, '') || 'File'
        return src ? [`[${name}](${src})`] : []
      }
      return [`![${(caption || alt).replace(/[[\]]/g, '')}](${src})`]
    }
    case 'hardBreak':
      return []
    default: {
      const text = textOf(node)
      return text ? [escapeText(text)] : []
    }
  }
}

/** Serializes the whole document to Markdown. */
export function toMarkdown(doc: Doc): string {
  const blocks = (doc.content ?? []).map(blockToMarkdown)
  const chunks: string[] = []
  for (const lines of blocks) {
    const text = lines.join('\n').trimEnd()
    if (text) chunks.push(text)
  }
  return `${chunks.join('\n\n')}\n`
}

// ---------------------------------------------------------------------------
// Markdown -> TipTap JSON
// ---------------------------------------------------------------------------

interface InlinePattern {
  readonly type: string
  readonly re: RegExp
}

const INLINE_PATTERNS: readonly InlinePattern[] = [
  { type: 'code', re: /(?<!\\)`([^`]+)`/ },
  { type: 'bold', re: /(?<!\\)\*\*([^*]+)\*\*/ },
  { type: 'italic', re: /(?<!\\)\*([^*]+)\*/ },
  { type: 'strike', re: /(?<!\\)~~([^~]+)~~/ },
  { type: 'underline', re: /(?<!\\)<u>([\s\S]*?)<\/u>/ },
  { type: 'link', re: /(?<!\\)\[([^\]]*)\]\(([^)\s]+)\)/ },
]

/** Parses inline Markdown into text/hardBreak nodes with marks. */
export function parseInline(text: string, marks: readonly DocMark[] = []): DocNode[] {
  let earliest: { index: number; length: number; pattern: InlinePattern; match: RegExpMatchArray } | null = null
  for (const pattern of INLINE_PATTERNS) {
    const match = text.match(pattern.re)
    if (match && match.index !== undefined && (earliest === null || match.index < earliest.index)) {
      earliest = { index: match.index, length: match[0].length, pattern, match }
    }
  }
  if (earliest === null) {
    const plain = unescapeText(text)
    return plain ? [{ type: 'text', text: plain, ...(marks.length > 0 ? { marks } : {}) }] : []
  }
  const nodes: DocNode[] = []
  nodes.push(...parseInline(text.slice(0, earliest.index), marks))
  const { pattern, match } = earliest
  if (pattern.type === 'code') {
    nodes.push({ type: 'text', text: match[1], marks: [...marks, { type: 'code' }] })
  } else if (pattern.type === 'link') {
    nodes.push(...parseInline(match[1], [...marks, { type: 'link', attrs: { href: match[2] } }]))
  } else {
    nodes.push(...parseInline(match[1], [...marks, { type: pattern.type }]))
  }
  nodes.push(...parseInline(text.slice(earliest.index + earliest.length), marks))
  return nodes
}

interface ListLine {
  readonly indent: number
  readonly ordered: boolean
  readonly checked: boolean | null
  readonly text: string
}

const LIST_LINE = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.*)$/
const TASK_TEXT = /^\[([ xX])\]\s+(.*)$/

function matchListLine(line: string): ListLine | null {
  const match = line.match(LIST_LINE)
  if (!match) return null
  const task = match[4].match(TASK_TEXT)
  if (task && match[2] !== undefined) {
    return { indent: match[1].length, ordered: false, checked: task[1].toLowerCase() === 'x', text: task[2] }
  }
  return { indent: match[1].length, ordered: match[3] !== undefined, checked: null, text: match[4] }
}

/** Builds nested list nodes from consecutive list lines. */
function buildList(lines: readonly ListLine[], start: number, indent: number): { node: DocNode; next: number } {
  const first = lines[start]
  const type = first.checked !== null ? 'taskList' : first.ordered ? 'orderedList' : 'bulletList'
  const itemType = type === 'taskList' ? 'taskItem' : 'listItem'
  const items: DocNode[] = []
  let i = start
  while (i < lines.length) {
    const line = lines[i]
    if (line.indent < indent) break
    if (line.indent > indent) {
      // Nested list: attach to the previous item.
      const previous = items[items.length - 1]
      if (!previous) break
      const nested = buildList(lines, i, line.indent)
      items[items.length - 1] = { ...previous, content: [...(previous.content ?? []), nested.node] }
      i = nested.next
      continue
    }
    const sameKind = (line.checked !== null) === (type === 'taskList') && line.ordered === (type === 'orderedList')
    if (!sameKind) break
    const item: DocNode = {
      type: itemType,
      ...(type === 'taskList' ? { attrs: { checked: line.checked === true } } : {}),
      content: [{ type: 'paragraph', content: parseInline(line.text) }],
    }
    items.push(item)
    i += 1
  }
  return { node: { type, content: items }, next: i }
}

const TABLE_SEPARATOR = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/

function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'))
}

/** Parses Markdown into TipTap document JSON (a content-preserving subset; see README). */
export function fromMarkdown(markdown: string): Doc {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks: DocNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i += 1
      continue
    }
    const fence = line.match(/^\s*(`{3,}|~{3,})(\w*)\s*$/)
    if (fence) {
      const code: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith(fence[1][0].repeat(3))) {
        code.push(lines[i])
        i += 1
      }
      i += 1 // closing fence
      blocks.push({
        type: 'codeBlock',
        ...(fence[2] ? { attrs: { language: fence[2] } } : {}),
        content: [{ type: 'text', text: code.join('\n') }],
      })
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      blocks.push({ type: 'heading', attrs: { level: heading[1].length }, content: parseInline(heading[2]) })
      i += 1
      continue
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: 'horizontalRule' })
      i += 1
      continue
    }
    if (line.match(/^\s*>/)) {
      const quoted: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quoted.push(lines[i].replace(/^\s*>\s?/, ''))
        i += 1
      }
      blocks.push({ type: 'blockquote', content: fromMarkdown(quoted.join('\n')).content ?? [] })
      continue
    }
    const image = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/)
    if (image) {
      blocks.push({
        type: 'media',
        attrs: { kind: 'image', src: image[2], width: null, align: 'center' },
        content: image[1] ? [{ type: 'text', text: image[1] }] : [],
      })
      i += 1
      continue
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1]) && line.trim() !== '') {
      const headerCells = parseTableRow(line)
      const rows: DocNode[] = [
        {
          type: 'tableRow',
          content: headerCells.map((cell) => ({
            type: 'tableHeader',
            content: [{ type: 'paragraph', content: parseInline(cell) }],
          })),
        },
      ]
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push({
          type: 'tableRow',
          content: parseTableRow(lines[i]).map((cell) => ({
            type: 'tableCell',
            content: [{ type: 'paragraph', content: parseInline(cell) }],
          })),
        })
        i += 1
      }
      blocks.push({ type: 'table', content: rows })
      continue
    }
    const listLine = matchListLine(line)
    if (listLine) {
      const collected: ListLine[] = []
      while (i < lines.length) {
        const matched = matchListLine(lines[i])
        if (!matched) break
        collected.push(matched)
        i += 1
      }
      let position = 0
      while (position < collected.length) {
        const built = buildList(collected, position, collected[position].indent)
        blocks.push(built.node)
        position = built.next
      }
      continue
    }
    const paragraphLines: string[] = [line]
    i += 1
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^(#{1,6}\s|\s*>|\s*(`{3,}|~{3,})|(\s*)([-*+]|\d+[.)])\s)/) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
    ) {
      paragraphLines.push(lines[i])
      i += 1
    }
    const content: DocNode[] = []
    paragraphLines.forEach((paragraphLine, index) => {
      if (index > 0) content.push({ type: 'hardBreak' })
      content.push(...parseInline(paragraphLine))
    })
    blocks.push({ type: 'paragraph', content })
  }
  return { type: 'doc', content: blocks }
}
