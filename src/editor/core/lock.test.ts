// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import StarterKit from '@tiptap/starter-kit'
import { createTestEditor, typeText } from './testing/createTestEditor'

/**
 * The page lock's guarantee: while locked, no document-changing transaction gets through,
 * from any source; unlocking restores editing.
 */
describe('page lock', () => {
  it('blocks document mutations while locked and allows them again after unlocking', () => {
    const { editor, destroy } = createTestEditor({
      plugins: [{ id: 'text', extensions: [StarterKit] }],
      content: '<p>hello</p>',
    })
    const before = editor.getText()

    expect(editor.commands.setPageLocked(true)).toBe(true)
    expect(editor.isEditable).toBe(false)

    // Direct text insertion, undo and any other doc-changing transaction are filtered out.
    editor.view.dispatch(editor.state.tr.insertText('MUTATION'))
    typeText(editor, 'typed')
    editor.commands.undo()
    expect(editor.getText()).toBe(before)

    // Selection-only transactions still work (reading, copying, clicking links).
    editor.view.dispatch(editor.state.tr.setSelection(editor.state.selection))
    expect(editor.getText()).toBe(before)

    expect(editor.commands.setPageLocked(false)).toBe(true)
    expect(editor.isEditable).toBe(true)
    typeText(editor, '!')
    expect(editor.getText()).toContain('!')
    destroy()
  })
})
