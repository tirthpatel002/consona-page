// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTestEditor, plainHtml, typeText } from '../../editor/core'
import { listsPlugin } from '../lists'
import { textPlugin } from '../text'
import { formattingPlugin } from '.'
import { setBackgroundColor, setTextColor } from './operations'

const make = () => createTestEditor({ plugins: [textPlugin(), listsPlugin, formattingPlugin], content: '<p>hello</p>' })

describe('formatting plugin', () => {
  it('sets and clears text colour as single undo steps', () => {
    const { editor, destroy } = make()
    editor.commands.selectAll()
    setTextColor.run(editor, '#d44c47')
    expect(editor.getAttributes('textStyle').color).toBe('#d44c47')
    editor.commands.undo()
    expect(plainHtml(editor)).toBe('<p>hello</p>')
    destroy()
  })

  it('sets a highlight and removes it with null', () => {
    const { editor, destroy } = make()
    editor.commands.selectAll()
    setBackgroundColor.run(editor, '#fdecc8')
    expect(editor.getAttributes('textStyle').backgroundColor).toBe('#fdecc8')
    setBackgroundColor.run(editor, null)
    expect(editor.getAttributes('textStyle').backgroundColor ?? null).toBeNull()
    destroy()
  })

  it('exposes marks, link and colours as bubble items', () => {
    const { registry, destroy, editor } = make()
    const ids = registry.toolbarItems.filter((i) => i.placement === 'bubble' || i.placement === 'both').map((i) => i.id)
    expect(ids).toEqual([
      'formatting:bold',
      'formatting:italic',
      'formatting:underline',
      'formatting:strike',
      'formatting:code',
      'formatting:link',
      'formatting:colors',
    ])
    destroy()
    void editor
  })

  it('turns markdown shortcuts into blocks', () => {
    const cases: [string, string][] = [
      ['# ', '<h1>'],
      ['- ', '<ul>'],
      ['1. ', '<ol>'],
      ['> ', '<blockquote>'],
      ['``` ', '<pre>'],
      ['---', '<hr>'],
    ]
    for (const [typed, expected] of cases) {
      const { editor, destroy } = make()
      editor.commands.setContent('<p></p>')
      editor.commands.focus('end')
      typeText(editor, typed)
      expect(plainHtml(editor), typed).toContain(expected)
      destroy()
    }
  })
})
