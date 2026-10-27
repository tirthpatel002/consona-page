// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { formattingPlugin } from '../../plugins/formatting'
import { toDocx } from '../../plugins/export/docx'
import { fromHtml, toHtml } from '../../plugins/export/html'
import { toMarkdown } from '../../plugins/export/markdown'
import type { Doc } from '../../plugins/export/types'
import { listsPlugin } from '../../plugins/lists'
import { textPlugin } from '../../plugins/text'
import { tablePlugin } from './index'

const cell = (type: string, text: string) => ({
  type,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})
const content = {
  type: 'doc',
  content: [
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: ['Name', 'Qty', 'Note'].map((t) => cell('tableHeader', t)) },
        { type: 'tableRow', content: ['apple', '3', 'red'].map((t) => cell('tableCell', t)) },
        { type: 'tableRow', content: ['pear', '5', 'green'].map((t) => cell('tableCell', t)) },
      ],
    },
  ],
}

const setup = () => createTestEditor({ plugins: [textPlugin(), formattingPlugin, listsPlugin, tablePlugin], content })

const cellText = (doc: Doc): string[][] =>
  (doc.content?.[0]?.content ?? []).map((row) =>
    (row.content ?? []).map((c) =>
      (c.content ?? []).map((p) => (p.content ?? []).map((t) => t.text ?? '').join('')).join(''),
    ),
  )

/** Puts the caret in the cell with this text. */
const caretIn = (editor: ReturnType<typeof setup>['editor'], text: string) => {
  let pos = -1
  editor.state.doc.descendants((node, p) => {
    if (pos < 0 && node.isText && node.text === text) pos = p + 1
  })
  editor.commands.setTextSelection(pos)
}

describe('exports and copy after a move', () => {
  it('Markdown, HTML and Word follow the moved column and moved row; HTML re-imports to the same order', () => {
    const { editor, destroy } = setup()
    caretIn(editor, 'Qty')
    expect(editor.commands.moveTableColumnBy(-1)).toBe(true) // Qty first
    caretIn(editor, 'pear')
    expect(editor.commands.moveTableRowBy(-1)).toBe(true) // pear above apple
    const doc = editor.getJSON() as Doc
    const expected = [
      ['Qty', 'Name', 'Note'],
      ['5', 'pear', 'green'],
      ['3', 'apple', 'red'],
    ]
    expect(cellText(doc)).toEqual(expected)

    const md = toMarkdown(doc).trim().split('\n')
    expect(md[0]).toMatch(/Qty.*Name.*Note/)
    expect(md[2]).toMatch(/5.*pear.*green/)
    expect(md[3]).toMatch(/3.*apple.*red/)

    const html = toHtml(doc)
    const order = ['Qty', 'Name', 'Note', '>5<', '>pear<', '>green<', '>3<', '>apple<', '>red<'].map((s) =>
      html.indexOf(s),
    )
    expect(order.every((n) => n >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(cellText(fromHtml(html))).toEqual(expected)

    const xml = new TextDecoder().decode(toDocx(doc))
    const words = ['>Qty<', '>Name<', '>Note<', '>5<', '>pear<', '>green<', '>3<', '>apple<', '>red<'].map((s) =>
      xml.indexOf(s),
    )
    expect(words.every((n) => n >= 0)).toBe(true)
    expect(words).toEqual([...words].sort((a, b) => a - b))
    destroy()
  })

  it('the editor HTML (what copy puts on the clipboard) keeps the moved order and the cell block ids', () => {
    const { editor, destroy } = setup()
    const idsOf = () => [...editor.getHTML().matchAll(/<t[dh][^>]*data-block-id="([^"]+)"/g)].map((m) => m[1])
    caretIn(editor, 'Note')
    const before = idsOf()
    editor.commands.moveTableColumnBy(-1)
    editor.commands.moveTableColumnBy(-1) // Note first
    const after = idsOf()
    expect(after).toHaveLength(before.length)
    // the first column's ids are now the old last column's ids, not new ones
    expect(after.slice(0, 3)).toEqual([before[2], before[0], before[1]])
    expect(after.slice(3, 6)).toEqual([before[5], before[3], before[4]])
    const html = editor.getHTML()
    expect(html.indexOf('>Note<')).toBeLessThan(html.indexOf('>Name<'))
    destroy()
  })
})
