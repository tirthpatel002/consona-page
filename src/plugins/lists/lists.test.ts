// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTestEditor, plainHtml, typeText } from '../../editor/core'
import { textPlugin } from '../text'
import { listsPlugin } from '.'
import { setListMarker, toggleChecklist } from './operations'

const make = (content: string) => createTestEditor({ plugins: [textPlugin(), listsPlugin], content })

describe('lists plugin', () => {
  it('typing "[] " makes a checklist and Tab nests an item', () => {
    const { editor, destroy } = make('<p></p>')
    editor.commands.focus('end')
    typeText(editor, '[ ] a')
    expect(plainHtml(editor)).toContain('data-type="taskList"')
    editor.commands.splitListItem('taskItem')
    typeText(editor, 'b')
    editor.commands.sinkListItem('taskItem')
    const item = editor.state.doc.firstChild?.firstChild
    expect(item?.childCount).toBe(2)
    expect(item?.child(1).type.name).toBe('taskList')
    destroy()
  })

  it('toggles a paragraph into a checklist in one undo step', () => {
    const { editor, destroy } = make('<p>todo</p>')
    editor.commands.focus('end')
    toggleChecklist.run(editor)
    expect(plainHtml(editor)).toContain('taskList')
    editor.commands.undo()
    expect(plainHtml(editor)).toBe('<p>todo</p>')
    destroy()
  })

  it('sets and validates list markers', () => {
    const { editor, destroy } = make('<ul><li><p>x</p></li></ul>')
    setListMarker.run(editor, 0, 'square')
    expect(plainHtml(editor)).toContain('data-marker="square"')
    editor.commands.setContent('<ul data-marker="bogus"><li><p>x</p></li></ul>')
    expect(plainHtml(editor)).not.toContain('bogus')
    destroy()
  })

  it('sets the marker from a list item position as one undo step', () => {
    const { editor, destroy } = make('<ul><li><p>x</p></li><li><p>y</p></li></ul>')
    const trailing = /<p><\/p>$/ // the editor keeps an empty paragraph after a final list
    const before = plainHtml(editor).replace(trailing, '')
    expect(setListMarker.run(editor, 1, 'circle')).toBe(true)
    expect(plainHtml(editor)).toContain('data-marker="circle"')
    editor.commands.undo()
    expect(plainHtml(editor).replace(trailing, '')).toBe(before)
    destroy()
  })

  it('keeps bullet lists and markdown input rules working', () => {
    const { editor, destroy } = make('<p></p>')
    editor.commands.focus('end')
    typeText(editor, '- a')
    expect(plainHtml(editor)).toContain('<ul>')
    destroy()
  })
})
