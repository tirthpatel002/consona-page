// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { columnsPlugin } from '.'
import { addColumn, insertColumns, removeLastColumn, setColumnsLayout, ungroupColumns } from './operations'

const make = (content = '<p></p>') =>
  createTestEditor({ plugins: [{ id: 'text', extensions: [StarterKit] }, columnsPlugin], content })

/** Block summary; the editor's trailing empty paragraph after a final column list is not part of the layout. */
const shape = (editor: ReturnType<typeof make>['editor']) => {
  const nodes = [...editor.state.doc.content.content]
  const last = nodes[nodes.length - 1]
  if (
    last?.type.name === 'paragraph' &&
    last.content.size === 0 &&
    nodes[nodes.length - 2]?.type.name === 'columnList'
  ) {
    nodes.pop()
  }
  return nodes.map((node) =>
    node.type.name === 'columnList'
      ? `${node.type.name}[${node.attrs.layout}](${node.content.content.map((c) => c.textContent || '-').join('|')})`
      : node.type.name,
  )
}

describe('columns plugin', () => {
  it('replaces an empty paragraph with N columns and puts the caret in the first one', () => {
    const { editor, destroy } = make()
    expect(insertColumns.run(editor, 3, 'columns')).toBe(true)
    expect(shape(editor)).toEqual(['columnList[columns](-|-|-)'])
    editor.commands.insertContent('first')
    expect(shape(editor)).toEqual(['columnList[columns](first|-|-)'])
    destroy()
  })

  it('inserts after a non-empty block and undoes as one step', () => {
    const { editor, destroy } = make('<p>keep</p>')
    const original = editor.getJSON()
    editor.commands.setTextSelection(2)
    insertColumns.run(editor, 2, 'grid')
    expect(shape(editor)).toEqual(['paragraph', 'columnList[grid](-|-)'])
    editor.commands.undo()
    expect(editor.getJSON()).toEqual(original)
    destroy()
  })

  it('adds and removes columns within 2..5, keeping the removed column content', () => {
    const { editor, destroy } = make()
    insertColumns.run(editor, 2, 'columns')
    expect(removeLastColumn.run(editor, 0)).toBe(false)
    for (let i = 0; i < 3; i += 1) expect(addColumn.run(editor, 0)).toBe(true)
    expect(addColumn.run(editor, 0)).toBe(false)
    expect(shape(editor)).toEqual(['columnList[columns](-|-|-|-|-)'])
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'columnList',
          attrs: { layout: 'columns' },
          content: [
            { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
            { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] },
            { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'C' }] }] },
          ],
        },
      ],
    })
    expect(removeLastColumn.run(editor, 0)).toBe(true)
    expect(shape(editor)).toEqual(['columnList[columns](A|BC)'])
    destroy()
  })

  it('switches layout and ungroups into plain blocks in column order', () => {
    const { editor, destroy } = make()
    insertColumns.run(editor, 2, 'columns')
    expect(setColumnsLayout.run(editor, 0, 'grid')).toBe(true)
    expect(setColumnsLayout.run(editor, 0, 'grid')).toBe(false)
    expect(shape(editor)).toEqual(['columnList[grid](-|-)'])
    expect(ungroupColumns.run(editor, 0)).toBe(true)
    expect(shape(editor)).toEqual(['paragraph', 'paragraph', 'paragraph']) // two from the columns + the trailing one
    destroy()
  })

  it('round-trips through HTML', () => {
    const { editor, destroy } = make()
    insertColumns.run(editor, 2, 'grid')
    const html = editor.getHTML()
    expect(html).toContain('data-type="column-list"')
    expect(html).toContain('data-layout="grid"')
    editor.commands.setContent(html)
    expect(shape(editor)).toEqual(['columnList[grid](-|-)'])
    destroy()
  })
})
