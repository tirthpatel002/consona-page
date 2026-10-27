// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { createTestEditor, deleteRange, moveBlocksTo } from '../../editor/core'
import { columnsPlugin } from '.'
import {
  dropBeside,
  insertColumns,
  planDropBeside,
  removeLastColumn,
  setColumnWidths,
  ungroupColumns,
} from './operations'

const p = (text: string) => `<p>${text}</p>`
const col = (...texts: string[]) => `<div data-type="column">${texts.map(p).join('')}</div>`
const list = (...cols: string[]) => `<div data-type="column-list" data-layout="columns">${cols.join('')}</div>`

const make = (html: string) =>
  createTestEditor({ plugins: [{ id: 'text', extensions: [StarterKit] }, columnsPlugin], content: html })
type Ed = ReturnType<typeof make>['editor']

/** Compact structure: paragraphs as text, lists as [a|b,c]. */
const describeDoc = (editor: Ed) => {
  const walk = (node: Ed['state']['doc']): string =>
    node.type.name === 'columnList'
      ? `[${node.content.content.map(walk).join('|')}]`
      : node.type.name === 'column'
        ? node.content.content.map(walk).join(',')
        : node.textContent || '-'
  return editor.state.doc.content.content.map(walk).join(' ').replace(/ -$/, '')
}
const posOf = (editor: Ed, text: string) => {
  let found = -1
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.type.name === 'paragraph' && node.textContent === text) found = pos
    return found < 0
  })
  return found
}
const sizeAt = (editor: Ed, pos: number) => editor.state.doc.nodeAt(pos)?.nodeSize ?? 0
/** Document JSON without the editor's trailing empty paragraph (added after the first edit). */
const json = (editor: Ed) => {
  const doc = editor.getJSON()
  const content = [...(doc.content ?? [])]
  const last = content[content.length - 1]
  if (last?.type === 'paragraph' && !last.content) content.pop()
  return { ...doc, content }
}
const textOf = (editor: Ed) => editor.state.doc.textContent

describe('side drops', () => {
  it('creates a column list beside a plain block (left and right) as one undo step', () => {
    const { editor, destroy } = make(p('A') + p('B') + p('C'))
    const before = json(editor)
    const c = posOf(editor, 'C')
    expect(dropBeside.run(editor, c, c + sizeAt(editor, c), posOf(editor, 'A'), 'left')).toBe(true)
    expect(describeDoc(editor)).toBe('[C|A] B')
    editor.commands.undo()
    expect(json(editor)).toEqual(before)
    const a = posOf(editor, 'A')
    expect(dropBeside.run(editor, a, a + sizeAt(editor, a), posOf(editor, 'C'), 'right')).toBe(true)
    expect(describeDoc(editor)).toBe('B [C|A]')
    destroy()
  })

  it('adds a column beside a block inside a list and keeps every block', () => {
    const { editor, destroy } = make(list(col('A'), col('B')) + p('C'))
    const before = json(editor)
    const c = posOf(editor, 'C')
    expect(dropBeside.run(editor, c, c + sizeAt(editor, c), posOf(editor, 'B'), 'right')).toBe(true)
    expect(describeDoc(editor).replace(/ -$/, '')).toBe('[A|B|C]')
    editor.commands.undo()
    expect(json(editor)).toEqual(before)
    destroy()
  })

  it('refuses a sixth column, dropping a list into a column, and dropping onto itself', () => {
    const { editor, destroy } = make(list(col('1'), col('2'), col('3'), col('4'), col('5')) + p('X'))
    const x = posOf(editor, 'X')
    expect(planDropBeside(editor.state.doc, x, x + sizeAt(editor, x), posOf(editor, '5'), 'right')).toBeNull()
    const nestedTarget = make(list(col('A'), col('B')) + list(col('C'), col('D')))
    const second = nestedTarget.editor.state.doc.child(0).nodeSize
    expect(
      planDropBeside(
        nestedTarget.editor.state.doc,
        second,
        second + nestedTarget.editor.state.doc.child(1).nodeSize,
        posOf(nestedTarget.editor, 'A'),
        'left',
      ),
    ).toBeNull()
    expect(planDropBeside(editor.state.doc, x, x + sizeAt(editor, x), x, 'left')).toBeNull()
    nestedTarget.destroy()
    destroy()
  })
})

describe('emptied columns', () => {
  it('removes a column whose last block was dragged out and keeps the others', () => {
    const { editor, destroy } = make(list(col('A'), col('B'), col('C')) + p('X'))
    const before = json(editor)
    const b = posOf(editor, 'B')
    const x = posOf(editor, 'X')
    expect(moveBlocksTo.run(editor, b, b + sizeAt(editor, b), x)).toBe(true)
    expect(describeDoc(editor)).toBe('[A|C] B X')
    expect(textOf(editor)).toHaveLength(4)
    editor.commands.undo()
    expect(json(editor)).toEqual(before)
    destroy()
  })

  it('turns a two-column list into plain blocks when one column empties, without losing content', () => {
    const { editor, destroy } = make(list(col('A', 'A2'), col('B')) + p('X'))
    const before = json(editor)
    const b = posOf(editor, 'B')
    moveBlocksTo.run(editor, b, b + sizeAt(editor, b), null)
    expect(describeDoc(editor)).toBe('A A2 X B')
    editor.commands.undo()
    expect(json(editor)).toEqual(before)
    destroy()
  })

  it('removes an emptied column when its block is deleted, but keeps a column the user merely cleared', () => {
    const { editor, destroy } = make(list(col('A'), col('B'), col('C')))
    const b = posOf(editor, 'B')
    deleteRange.run(editor, b, b + sizeAt(editor, b))
    expect(describeDoc(editor).replace(/ -$/, '')).toBe('[A|C]')
    editor.commands.undo()
    expect(describeDoc(editor).replace(/ -$/, '')).toBe('[A|B|C]')
    const a = posOf(editor, 'A')
    editor.commands.setTextSelection({ from: a + 1, to: a + 2 })
    editor.commands.deleteSelection()
    expect(describeDoc(editor).replace(/ -$/, '')).toBe('[-|B|C]')
    destroy()
  })

  it('moves a block between columns without removing a column that still has content', () => {
    const { editor, destroy } = make(list(col('A', 'A2'), col('B')))
    const a2 = posOf(editor, 'A2')
    const b = posOf(editor, 'B')
    moveBlocksTo.run(editor, a2, a2 + sizeAt(editor, a2), b)
    expect(describeDoc(editor).replace(/ -$/, '')).toBe('[A|A2,B]')
    destroy()
  })
})

describe('content safety and constraints', () => {
  it('remove-last-column and ungroup keep all text', () => {
    const { editor, destroy } = make(list(col('A'), col('B', 'B2'), col('C')))
    const before = textOf(editor)
    removeLastColumn.run(editor, 0)
    expect(textOf(editor)).toBe(before)
    expect(describeDoc(editor).replace(/ -$/, '')).toBe('[A|B,B2,C]')
    ungroupColumns.run(editor, 0)
    expect(textOf(editor)).toBe(before)
    destroy()
  })

  it('flattens a column list pasted into a column and refuses to insert one there', () => {
    const { editor, destroy } = make(list(col('A'), col('B')))
    const a = posOf(editor, 'A')
    editor.commands.setTextSelection(a + 1)
    expect(insertColumns.run(editor, 2, 'columns')).toBe(false)
    editor.commands.insertContentAt(a + sizeAt(editor, a), list(col('N1'), col('N2')))
    expect(describeDoc(editor).replace(/ -$/, '')).not.toMatch(/\[[^\]]*\[/)
    expect(textOf(editor)).toContain('N1')
    expect(textOf(editor)).toContain('N2')
    destroy()
  })

  it('stores column widths as one undoable step and rejects bad weights', () => {
    const { editor, destroy } = make(list(col('A'), col('B')))
    const before = json(editor)
    expect(setColumnWidths.run(editor, 0, [1, 1])).toBe(false)
    expect(setColumnWidths.run(editor, 0, [1, 0])).toBe(false)
    expect(setColumnWidths.run(editor, 0, [0.5, 1.5])).toBe(true)
    expect(editor.getHTML()).toContain('flex-grow: 0.5')
    editor.commands.undo()
    expect(json(editor)).toEqual(before)
    destroy()
  })
})
