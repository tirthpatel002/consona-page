// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { KEEP_PLUGIN_SELECTION_META, createTestEditor } from '../../editor/core'
import { columnsPlugin } from '../columns'
import { blockSelectionPlugin } from '.'
import { extendSelectionTo, runOnSelection, selectBlockAt } from './blockSelection'

const make = (content: string) =>
  createTestEditor({
    plugins: [{ id: 'text', extensions: [StarterKit] }, columnsPlugin, blockSelectionPlugin],
    content,
  })
const selected = (dom: HTMLElement) => [...dom.querySelectorAll('.page-block-selected')].map((e) => e.textContent)
const posOf = (editor: ReturnType<typeof make>['editor'], text: string) => {
  let found = -1
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isTextblock && node.textContent === text) found = pos
  })
  return found
}

describe('block selection from the handle menu (touch route)', () => {
  it('selects, extends, survives the menu node-selection, duplicates and deletes', () => {
    const { editor, destroy } = make('<p>A</p><p>B</p><p>C</p><p>D</p>')
    const dom = editor.view.dom
    const original = editor.getText({ blockSeparator: ',' })
    expect(selectBlockAt(editor, posOf(editor, 'B'))).toBe(true)
    // Opening another block's menu node-selects it; that must not clear the block selection.
    editor.chain().setMeta(KEEP_PLUGIN_SELECTION_META, true).setNodeSelection(posOf(editor, 'C')).run()
    expect(extendSelectionTo(editor, posOf(editor, 'C'))).toBe(true)
    expect(selected(dom)).toEqual(['B', 'C'])
    expect(runOnSelection(editor, 'duplicate')).toBe(true)
    expect(editor.getText({ blockSeparator: ',' })).toContain('A,B,C,B,C,D')
    selectBlockAt(editor, posOf(editor, 'D'))
    expect(runOnSelection(editor, 'delete')).toBe(true)
    expect(editor.getText({ blockSeparator: ',' })).toContain('A,B,C,B,C')
    editor.commands.undo()
    editor.commands.undo()
    expect(editor.getText({ blockSeparator: ',' })).toContain(original)
    destroy()
  })

  it('works inside a column and does nothing without a selection', () => {
    const { editor, destroy } = make(
      '<div data-type="column-list" data-layout="columns"><div data-type="column"><p>x1</p><p>x2</p></div><div data-type="column"><p>y1</p></div></div><p>end</p>',
    )
    expect(runOnSelection(editor, 'delete')).toBe(false)
    selectBlockAt(editor, posOf(editor, 'x1'))
    expect(selected(editor.view.dom)).toEqual(['x1'])
    extendSelectionTo(editor, posOf(editor, 'x2'))
    expect(selected(editor.view.dom)).toEqual(['x1', 'x2'])
    destroy()
  })
})
