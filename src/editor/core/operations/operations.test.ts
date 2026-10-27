// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { createTestEditor, plainHtml } from '../testing/createTestEditor'
import { operationOf } from './defineOperation'
import { moveBlocksTo, setLink, toggleMark, unsetLink } from './operations'

describe('operations', () => {
  it('toggles a mark as one undoable step stamped with its id', () => {
    const seen: (string | undefined)[] = []
    const { editor, destroy } = createTestEditor({
      plugins: [{ id: 'text', extensions: [StarterKit] }],
      content: '<p>hello</p>',
    })
    editor.on('transaction', ({ transaction }) => seen.push(operationOf(transaction)))
    editor.commands.selectAll()
    expect(toggleMark.run(editor, 'bold')).toBe(true)
    expect(plainHtml(editor)).toContain('<strong>hello</strong>')
    expect(seen).toContain('toggleMark')
    editor.commands.undo()
    expect(plainHtml(editor)).toBe('<p>hello</p>')
    destroy()
  })

  it('sets and removes a link over the selection', () => {
    const { editor, destroy } = createTestEditor({
      plugins: [{ id: 'text', extensions: [StarterKit] }],
      content: '<p>hello</p>',
    })
    editor.commands.selectAll()
    setLink.run(editor, 'https://example.com')
    expect(plainHtml(editor)).toContain('href="https://example.com"')
    unsetLink.run(editor)
    expect(plainHtml(editor)).not.toContain('href')
    destroy()
  })

  it('moves a block before another (or to the end) as one undo step', () => {
    const { editor, destroy } = createTestEditor({
      plugins: [{ id: 'text', extensions: [StarterKit] }],
      content: '<p>a</p><p>b</p><p>c</p>',
    })
    const positions: number[] = []
    editor.state.doc.forEach((_node, offset) => positions.push(offset))
    const [first = 0, second = 0, third = 0] = positions
    const before = plainHtml(editor)
    expect(moveBlocksTo.run(editor, first, second, third)).toBe(true)
    expect(plainHtml(editor)).toBe('<p>b</p><p>a</p><p>c</p>')
    editor.commands.undo()
    expect(plainHtml(editor)).toBe(before)
    expect(moveBlocksTo.run(editor, first, second, null)).toBe(true)
    expect(plainHtml(editor)).toBe('<p>b</p><p>c</p><p>a</p>')
    expect(moveBlocksTo.run(editor, second, third, third)).toBe(false)
    destroy()
  })
})
