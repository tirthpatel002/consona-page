// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { columnsPlugin } from '../columns'
import { blockSelectionPlugin } from '.'

const col = (...texts: string[]) => `<div data-type="column">${texts.map((t) => `<p>${t}</p>`).join('')}</div>`
const html = `<p>Top</p><div data-type="column-list" data-layout="columns">${col('A1', 'A2', 'A3')}${col('B1')}</div>`

const press = (dom: HTMLElement, key: string, init: KeyboardEventInit = {}) =>
  dom.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
const selected = (dom: HTMLElement) =>
  [...dom.querySelectorAll('.page-block-selected')].map((element) => element.textContent)

const make = () =>
  createTestEditor({
    plugins: [{ id: 'text', extensions: [StarterKit] }, columnsPlugin, blockSelectionPlugin],
    content: html,
  })

const caretIn = (editor: ReturnType<typeof make>['editor'], text: string) => {
  let found = -1
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isTextblock && node.textContent === text) found = pos + 1
  })
  editor.commands.setTextSelection(found)
}

describe('block selection inside columns', () => {
  it('Esc selects the block in its column; Shift+Down stays inside that column', () => {
    const { editor, destroy } = make()
    const dom = editor.view.dom
    caretIn(editor, 'A2')
    press(dom, 'Escape')
    expect(selected(dom)).toEqual(['A2'])
    press(dom, 'ArrowDown', { shiftKey: true })
    press(dom, 'ArrowDown', { shiftKey: true })
    expect(selected(dom)).toEqual(['A2', 'A3'])
    destroy()
  })

  it('duplicate and delete work on the column blocks, each one undo step', () => {
    const { editor, destroy } = make()
    const dom = editor.view.dom
    const original = JSON.stringify(editor.getJSON())
    caretIn(editor, 'A2')
    press(dom, 'Escape')
    press(dom, 'd', { ctrlKey: true })
    expect(editor.getText({ blockSeparator: ',' })).toContain('A1,A2,A2,A3')
    press(dom, 'Backspace')
    expect(editor.getText({ blockSeparator: ',' })).toContain('A1,A2,A3')
    expect(() => editor.state.doc.check()).not.toThrow()
    editor.commands.undo()
    editor.commands.undo()
    expect(JSON.stringify(editor.getJSON()).replace(/,\{"type":"paragraph"\}\]\}$/, ']}')).toBe(original)
    destroy()
  })

  it('top-level blocks still select as before', () => {
    const { editor, destroy } = make()
    const dom = editor.view.dom
    caretIn(editor, 'Top')
    press(dom, 'Escape')
    expect(selected(dom)).toEqual(['Top'])
    destroy()
  })
})
