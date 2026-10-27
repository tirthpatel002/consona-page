// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import { createTestEditor } from '../src/editor/core'
import { reorderTransaction } from '../src/blocks/table/reorder'
import { toHtml } from '../src/plugins/export/html'
import { toMarkdown } from '../src/plugins/export/markdown'
import type { Doc } from '../src/plugins/export/types'
import { pagePlugins } from './plugins'

const TABLE =
  '<table><tbody>' +
  '<tr><th>H1</th><th>H2</th><th>H3</th></tr>' +
  '<tr><td>a1</td><td>a2</td><td>a3</td></tr>' +
  '<tr><td>b1</td><td>b2</td><td>b3</td></tr>' +
  '</tbody></table>'

const make = () => createTestEditor({ plugins: pagePlugins, content: TABLE })
const tablePos = (editor: Editor) => {
  let found = -1
  editor.state.doc.descendants((node, pos) => {
    if (node.type.spec.tableRole === 'table' && found < 0) found = pos
    return found < 0
  })
  return found
}
/** blockId of each text-bearing cell, keyed by its text. */
const idsByText = (editor: Editor) => {
  const out: Record<string, string> = {}
  editor.state.doc.descendants((node) => {
    if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') {
      out[node.textContent] = String(node.attrs.blockId)
    }
  })
  return out
}
const rowIds = (editor: Editor) => {
  const ids: string[] = []
  editor.state.doc.descendants((node) => {
    if (node.type.spec.tableRole === 'row') ids.push(String(node.attrs.blockId))
  })
  return ids
}
const move = (editor: Editor, axis: 'row' | 'column', from: number, to: number) => {
  const tr = reorderTransaction(editor.state, tablePos(editor), axis, from, to, { kind: 'cells' })
  if (!tr) throw new Error('move refused')
  editor.view.dispatch(tr)
}

describe('table reorder with block ids, history and export', () => {
  it('a column move keeps every cell id, and undo and redo restore ids and order', () => {
    const { editor, destroy } = make()
    const before = idsByText(editor)
    expect(Object.keys(before).length).toBe(9)
    move(editor, 'column', 0, 2)
    expect(idsByText(editor)).toEqual(before)
    const moved = editor.state.doc.toJSON()
    editor.commands.undo()
    expect(idsByText(editor)).toEqual(before)
    expect(editor.state.doc.textBetween(0, editor.state.doc.content.size, '|')).toContain('H1|H2|H3')
    editor.commands.redo()
    expect(editor.state.doc.toJSON()).toEqual(moved)
    destroy()
  })

  it('a row move keeps row and cell ids, and the header row stays first', () => {
    const { editor, destroy } = make()
    const rows = rowIds(editor)
    const cells = idsByText(editor)
    move(editor, 'row', 1, 2)
    expect(rowIds(editor)).toEqual([rows[0], rows[2], rows[1]])
    expect(idsByText(editor)).toEqual(cells)
    editor.commands.undo()
    expect(rowIds(editor)).toEqual(rows)
    destroy()
  })

  it('exports follow the new order: Markdown, HTML', () => {
    const { editor, destroy } = make()
    move(editor, 'column', 0, 2)
    move(editor, 'row', 1, 2)
    const doc = editor.getJSON() as unknown as Doc
    const markdown = toMarkdown(doc)
    const lines = markdown.split('\n').filter((line) => line.startsWith('|') && !/^\|\s*-/.test(line))
    const cells = (line: string) =>
      line
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
    expect(cells(lines[0] ?? '')).toEqual(['H2', 'H3', 'H1'])
    expect(cells(lines[1] ?? '')).toEqual(['b2', 'b3', 'b1'])
    expect(cells(lines[2] ?? '')).toEqual(['a2', 'a3', 'a1'])
    const html = toHtml(doc, { standalone: false })
    expect(html.indexOf('H2')).toBeLessThan(html.indexOf('H3'))
    expect(html.indexOf('H3')).toBeLessThan(html.indexOf('H1'))
    expect(html.indexOf('b2')).toBeLessThan(html.indexOf('a2'))
    destroy()
  })

  it('the editor HTML (what copy writes) follows the moved order; paste of own copies is covered by the paste checks, not here', () => {
    const { editor, destroy } = make()
    move(editor, 'column', 0, 2)
    const html = editor.getHTML()
    expect(html.indexOf('H2')).toBeLessThan(html.indexOf('H1'))
    destroy()
  })
})
