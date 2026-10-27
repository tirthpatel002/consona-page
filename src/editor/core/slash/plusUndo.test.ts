// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import StarterKit from '@tiptap/starter-kit'
import { defineOperation } from '../operations/defineOperation'
import { createTestEditor, plainHtml } from '../testing/createTestEditor'
import { openSlashMenuBelow, removeSlashRange } from './operations'

const insertDivider = defineOperation('insertDivider', (chain) => chain.setHorizontalRule())

const setup = () => {
  const made = createTestEditor({ plugins: [{ id: 'text', extensions: [StarterKit] }], content: '<p>one</p>' })
  return made
}

describe('"+" menu and undo', () => {
  it('opening the menu from "+" adds a scaffold that is not an undo step', () => {
    const { editor, destroy } = setup()
    openSlashMenuBelow.run(editor, 0)
    expect(plainHtml(editor)).toBe('<p>one</p><p></p>')
    expect(editor.can().undo()).toBe(false)
    destroy()
  })

  it('choosing an item is one undo step that restores the exact prior document', () => {
    const { editor, destroy } = setup()
    const before = editor.getJSON()
    openSlashMenuBelow.run(editor, 0)
    const from = editor.state.doc.child(0).nodeSize + 1
    removeSlashRange.run(editor, from, from, true)
    insertDivider.run(editor)
    expect(plainHtml(editor)).toContain('<hr>')
    expect(editor.getText()).not.toContain('/')
    editor.commands.undo()
    expect(editor.getJSON()).toEqual(before)
    expect(editor.can().undo()).toBe(false)
    destroy()
  })
})
