import type { JSONContent } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Slice } from '@tiptap/pm/model'
import { fromHtml } from './html'
import { fromMarkdown, toMarkdown } from './markdown'
import { sanitizeImported } from './safeUrls'
import type { Doc, DocNode } from './types'
import { insertConverted } from './operations'

const MARKDOWN_HINT =
  /^(#{1,6} \S|[-*+] \S|\d+[.)] \S|> \S|```|- \[[ xX]\] |\|.+\|$)|\*\*\S.*\*\*|\[[^\]]+\]\(https?:[^)]+\)/m

/** True when plain text reads like Markdown rather than ordinary prose. */
export const looksLikeMarkdown = (text: string): boolean => text.includes('\n') && MARKDOWN_HINT.test(text)

/**
 * Blocks to insert for a paste from another app or page, or null to let the editor handle it.
 * Our own copies carry data-pm-slice and are left to ProseMirror so they paste exactly.
 */
export function pastedBlocks(html: string, text: string): readonly DocNode[] | null {
  if (html && !html.includes('data-pm-slice')) {
    const blocks = sanitizeImported(fromHtml(html)).content ?? []
    return blocks.length > 0 ? blocks : null
  }
  if (!html && looksLikeMarkdown(text)) {
    const blocks = sanitizeImported(fromMarkdown(text)).content ?? []
    return blocks.length > 0 ? blocks : null
  }
  return null
}

/** Clean paste of HTML (other apps) and Markdown text through the same converters as import. */
export const PasteConversion = Extension.create({
  name: 'pagePasteConversion',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('pagePasteConversion'),
        props: {
          handlePaste: (_view, event) => {
            const data = event.clipboardData
            if (!data || data.files.length > 0) return false
            const blocks = pastedBlocks(data.getData('text/html'), data.getData('text/plain'))
            if (!blocks) return false
            event.preventDefault()
            return insertConverted.run(editor, blocks as JSONContent[])
          },
        },
      }),
    ]
  },
})

/**
 * Plain-text flavour of a copy: Markdown for whole blocks (so pasting into a text editor or chat keeps headings,
 * lists and links), and the plain text for a selection inside one text block.
 */
export function markdownForSlice(slice: Slice): string {
  const first = slice.content.firstChild
  if (slice.content.childCount === 1 && first?.isTextblock && slice.openStart > 0) return first.textContent
  const doc = { type: 'doc', content: slice.content.toJSON() as DocNode[] } as Doc
  return toMarkdown(doc).replace(/\n+$/, '')
}

/** Makes every copy and cut put Markdown on the clipboard's plain-text flavour (the HTML flavour is unchanged). */
export const CopyAsMarkdown = Extension.create({
  name: 'pageCopyAsMarkdown',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('pageCopyAsMarkdown'),
        props: { clipboardTextSerializer: (slice) => markdownForSlice(slice) },
      }),
    ]
  },
})
