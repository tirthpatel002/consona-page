// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { insertConverted } from './operations'
import { fromMarkdown } from './markdown'

describe('insertConverted', () => {
  it('inserts imported blocks as one undo step', () => {
    const { editor, destroy } = createTestEditor({
      plugins: [{ id: 'text', extensions: [StarterKit] }],
      content: '<p>start</p>',
    })
    const before = JSON.stringify(editor.getJSON().content?.filter((n) => n.content))
    const blocks = (fromMarkdown('# Title\n\n- a\n- b\n\ntext').content ?? []) as never[]
    expect(insertConverted.run(editor, blocks)).toBe(true)
    expect(editor.getText()).toContain('Title')
    editor.commands.undo()
    expect(JSON.stringify(editor.getJSON().content?.filter((n) => n.content))).toBe(before)
    destroy()
  })
})
