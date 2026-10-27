import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'

const PREVIEW_MAX = 140

const truncate = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  if (flat.length <= PREVIEW_MAX) return flat
  return `${flat.slice(0, PREVIEW_MAX - 1)}…`
}

const textFromProps = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value
      .map((entry) => textFromProps(entry))
      .filter(Boolean)
      .join(' ')
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((entry) => textFromProps(entry))
      .filter(Boolean)
      .join(' ')
  }
  return ''
}

const blockAnchorExcerpt = (doc: PMNode, pos: number, node: PMNode): string => {
  if (node.type.name === 'embedBlock') {
    const fromProps = truncate(textFromProps(node.attrs.props))
    if (fromProps) return fromProps
  }
  const innerFrom = pos + 1
  const innerTo = pos + node.nodeSize - 1
  if (innerTo > innerFrom) {
    const fromDoc = truncate(doc.textBetween(innerFrom, innerTo, ' ', '\n'))
    if (fromDoc) return fromDoc
  }
  return blockFallbackLabel(node)
}

const blockFallbackLabel = (node: PMNode): string => {
  switch (node.type.name) {
    case 'heading':
      return 'Heading'
    case 'codeBlock':
      return 'Code block'
    case 'blockquote':
      return 'Quote'
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return 'List'
    case 'table':
      return 'Table'
    case 'horizontalRule':
      return 'Divider'
    case 'embedBlock':
      return 'Embed'
    default:
      return 'Block'
  }
}

export interface ThreadAnchorPreview {
  readonly text: string
  readonly from: number
  readonly to: number
  readonly kind: 'text' | 'block'
}

const textRangeForThread = (doc: PMNode, threadId: string): { from: number; to: number } | null => {
  const markType = doc.type.schema.marks.comment
  if (!markType) return null
  let from: number | null = null
  let to: number | null = null
  doc.descendants((node, pos) => {
    if (!node.isText) return
    const marked = node.marks.some((mark) => mark.type === markType && mark.attrs.threadId === threadId)
    if (!marked) return
    const start = pos
    const end = pos + node.nodeSize
    from = from === null ? start : Math.min(from, start)
    to = to === null ? end : Math.max(to, end)
  })
  if (from === null || to === null) return null
  return { from, to }
}

const blockForThread = (doc: PMNode, threadId: string): { pos: number; node: PMNode } | null => {
  let found: { pos: number; node: PMNode } | null = null
  doc.descendants((node, pos) => {
    if (found || node.attrs.commentThread !== threadId) return
    found = { pos, node }
  })
  return found
}

/** Live excerpt of what this thread is attached to in the document. */
export const getThreadAnchorPreview = (editor: Editor, threadId: string): ThreadAnchorPreview | null => {
  const { doc } = editor.state
  const textRange = textRangeForThread(doc, threadId)
  if (textRange) {
    const text = truncate(doc.textBetween(textRange.from, textRange.to, ' '))
    if (text) {
      return { text, from: textRange.from, to: textRange.to, kind: 'text' }
    }
  }
  const block = blockForThread(doc, threadId)
  if (!block) return null
  const text = blockAnchorExcerpt(doc, block.pos, block.node)
  return { text, from: block.pos, to: block.pos + block.node.nodeSize, kind: 'block' }
}

const flashAnchor = (threadId: string): void => {
  for (const el of document.querySelectorAll(`[data-comment-thread="${CSS.escape(threadId)}"]`)) {
    el.classList.add('page-comment--flash')
    window.setTimeout(() => el.classList.remove('page-comment--flash'), 1400)
  }
}

/** Focuses the anchor in the editor and scrolls it into view smoothly. */
export const navigateToThreadAnchor = (editor: Editor, threadId: string): void => {
  const preview = getThreadAnchorPreview(editor, threadId)
  if (!preview) {
    document.querySelector(`[data-comment-thread="${CSS.escape(threadId)}"]`)?.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    })
    return
  }
  const { state, view } = editor
  let tr = state.tr
  if (preview.kind === 'text' && preview.to > preview.from) {
    tr = tr.setSelection(TextSelection.create(state.doc, preview.from, preview.to))
  } else {
    const pos = Math.min(preview.from + 1, state.doc.content.size - 1)
    tr = tr.setSelection(TextSelection.near(state.doc.resolve(Math.max(1, pos))))
  }
  view.dispatch(tr.scrollIntoView())
  view.focus()
  flashAnchor(threadId)
}
