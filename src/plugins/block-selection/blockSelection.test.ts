// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { DRAG_RANGE_STORAGE, createTestEditor } from '../../editor/core'
import { blockSelectionPlugin } from '.'

const make = () =>
  createTestEditor({
    plugins: [{ id: 'text', extensions: [StarterKit] }, blockSelectionPlugin],
    content: '<p>Alpha</p><p>Bravo</p><p>Charlie</p><p>Delta</p>',
  })

const press = (dom: HTMLElement, key: string, init: KeyboardEventInit = {}) =>
  dom.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))

const selected = (dom: HTMLElement) =>
  [...dom.querySelectorAll('.page-block-selected')].map((element) => element.textContent)

describe('block selection plugin', () => {
  it('selects with Esc, extends with Shift+Down and clears on Esc', () => {
    const { editor, destroy } = make()
    editor.commands.setTextSelection(9)
    const dom = editor.view.dom
    press(dom, 'Escape')
    expect(selected(dom)).toEqual(['Bravo'])
    press(dom, 'ArrowDown', { shiftKey: true })
    expect(selected(dom)).toEqual(['Bravo', 'Charlie'])
    press(dom, 'Escape')
    expect(selected(dom)).toEqual([])
    destroy()
  })

  it('duplicate then delete are separate undo steps, each restoring the exact document', () => {
    const { editor, destroy } = make()
    const dom = editor.view.dom
    const original = editor.getJSON()
    editor.commands.setTextSelection(9)
    press(dom, 'Escape')
    press(dom, 'ArrowDown', { shiftKey: true })
    press(dom, 'd', { ctrlKey: true })
    const duplicated = editor.getJSON()
    expect(editor.getText({ blockSeparator: ',' })).toBe('Alpha,Bravo,Charlie,Bravo,Charlie,Delta')
    press(dom, 'Backspace')
    expect(editor.getText({ blockSeparator: ',' })).toBe('Alpha,Bravo,Charlie,Delta')
    editor.commands.undo()
    expect(editor.getJSON()).toEqual(duplicated)
    editor.commands.undo()
    expect(editor.getJSON()).toEqual(original)
    destroy()
  })

  it('copies and cuts the selected blocks', () => {
    const { editor, destroy } = make()
    const dom = editor.view.dom
    editor.commands.setTextSelection(9)
    press(dom, 'Escape')
    const data: Record<string, string> = {}
    const clipboardData = {
      clearData: () => undefined,
      setData: (type: string, value: string) => void (data[type] = value),
    }
    const fire = (type: 'copy' | 'cut') => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', { value: clipboardData })
      dom.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(fire('copy')).toBe(true)
    expect(data['text/plain']).toBe('Bravo')
    expect(data['text/html']).toContain('Bravo')
    expect(editor.getText({ blockSeparator: ',' })).toBe('Alpha,Bravo,Charlie,Delta')
    expect(fire('cut')).toBe(true)
    expect(editor.getText({ blockSeparator: ',' })).toBe('Alpha,Charlie,Delta')
    destroy()
  })

  it('offers the whole selection as the drag range for a selected block only', () => {
    const { editor, destroy } = make()
    editor.commands.setTextSelection(9)
    press(editor.view.dom, 'Escape')
    press(editor.view.dom, 'ArrowDown', { shiftKey: true })
    const storage = (
      editor.storage as unknown as Record<string, { resolve: (pos: number) => { from: number; to: number } | null }>
    )[DRAG_RANGE_STORAGE]
    const bravo = editor.state.doc.child(0).nodeSize
    const range = storage?.resolve(bravo)
    expect(range).toEqual({
      from: bravo,
      to: bravo + editor.state.doc.child(1).nodeSize + editor.state.doc.child(2).nodeSize,
    })
    expect(storage?.resolve(0)).toBeNull()
    destroy()
  })
})
