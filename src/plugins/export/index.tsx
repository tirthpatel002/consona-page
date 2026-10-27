import type { Editor, JSONContent } from '@tiptap/core'
import { Menu, type MenuEntry, type PagePlugin, type ToolbarItem } from '../../editor/core'
import { toDocx } from './docx'
import { downloadBlob, openPrintWindow } from './download'
import { fromHtml, toHtml } from './html'
import { fromMarkdown, toMarkdown } from './markdown'
import { CopyAsMarkdown, PasteConversion } from './paste'
import { sanitizeImported } from './safeUrls'
import { textOf, type Doc } from './types'
import { insertConverted } from './operations'

/** Filename base from the first heading, falling back to "page". */
export function pageTitle(doc: Doc): string {
  const heading = (doc.content ?? []).find((node) => node.type === 'heading')
  const text = heading ? textOf(heading).trim() : ''
  const safe = (text || 'page')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return safe || 'page'
}

function docOf(editor: Editor): Doc {
  return editor.getJSON() as Doc
}

function exportAs(editor: Editor, format: 'markdown' | 'html' | 'docx' | 'pdf'): void {
  const doc = docOf(editor)
  const title = pageTitle(doc)
  if (format === 'markdown') {
    downloadBlob(`${title}.md`, new Blob([toMarkdown(doc)], { type: 'text/markdown' }))
  } else if (format === 'html') {
    downloadBlob(`${title}.html`, new Blob([toHtml(doc, { title })], { type: 'text/html' }))
  } else if (format === 'docx') {
    downloadBlob(
      `${title}.docx`,
      new Blob([toDocx(doc).buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    )
  } else {
    openPrintWindow(toHtml(doc, { title }))
  }
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    window.prompt('Copy to clipboard: Ctrl/Cmd+C, then Enter', text)
  }
}

function importFile(editor: Editor, close: () => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.md,.markdown,.html,.htm,text/markdown,text/html,text/plain'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    void file.text().then((text) => {
      const imported = sanitizeImported(/\.(html?|htm)$/i.test(file.name) ? fromHtml(text) : fromMarkdown(text))
      insertConverted.run(editor, (imported.content ?? []) as JSONContent[])
      close()
    })
  }
  input.click()
}

const toolbarItems: readonly ToolbarItem[] = [
  {
    id: 'export:menu',
    group: 'export',
    label: 'Export',
    title: 'Export or import the page',
    icon: 'export',
    // Read-only-safe: exporting a locked page is fine (import is blocked by the lock's transaction filter).
    isEnabled: () => true,
    popover: ({ editor, close }) => {
      const entries: MenuEntry[] = [
        {
          id: 'markdown',
          label: 'Markdown (.md)',
          onSelect: () => {
            exportAs(editor, 'markdown')
            close()
          },
        },
        {
          id: 'html',
          label: 'HTML (.html)',
          onSelect: () => {
            exportAs(editor, 'html')
            close()
          },
        },
        {
          id: 'docx',
          label: 'Word (.docx)',
          onSelect: () => {
            exportAs(editor, 'docx')
            close()
          },
        },
        {
          id: 'pdf',
          label: 'PDF (print dialog)',
          onSelect: () => {
            exportAs(editor, 'pdf')
            close()
          },
        },
        {
          id: 'copy-markdown',
          label: 'Copy page as Markdown',
          onSelect: () => {
            void copyText(toMarkdown(docOf(editor)))
            close()
          },
        },
        {
          id: 'copy-html',
          label: 'Copy page as HTML',
          onSelect: () => {
            void copyText(toHtml(docOf(editor), { title: pageTitle(docOf(editor)) }))
            close()
          },
        },
        {
          id: 'import',
          label: 'Import Markdown / HTML…',
          disabled: !editor.isEditable,
          onSelect: () => importFile(editor, close),
        },
      ]
      return <Menu entries={entries} label="Export page" />
    },
  },
]

/** Export (Markdown, HTML, Word, PDF via print) and import (Markdown, HTML). Converters are pure. */
export const exportPlugin: PagePlugin = {
  id: 'export',
  extensions: [PasteConversion, CopyAsMarkdown],
  toolbarItems,
}
