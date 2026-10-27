// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTestEditor, typeText } from '../../editor/core'
import { listsPlugin } from '../lists'
import { togglePlugin } from '../../blocks/toggle'
import { textPlugin } from '.'
import { setToggle } from './operations'
import { textSlashItems } from './slashItems'

const make = (content = '<p></p>') => createTestEditor({ plugins: [textPlugin(), listsPlugin], content })

describe('text coverage', () => {
  it('marks empty blocks with the placeholder text', () => {
    const { editor, destroy } = make()
    expect(editor.view.dom.innerHTML).toContain('data-placeholder="Type \'/\' for commands…"')
    destroy()
  })

  it('offers quote and divider in the slash menu and they apply', () => {
    const titles = textSlashItems.map((item) => item.title)
    expect(titles).toEqual(expect.arrayContaining(['Quote', 'Divider']))
    const { editor, destroy } = make('<p>quoted</p>')
    textSlashItems.find((item) => item.title === 'Quote')?.run(editor)
    expect(editor.getHTML()).toContain('<blockquote>')
    editor.commands.undo()
    expect(editor.getHTML()).toBe('<p>quoted</p>')
    destroy()
  })

  it('supports both checklist shortcuts and inline-code/bold markdown', () => {
    for (const typed of ['[ ] ', '[] ']) {
      const { editor, destroy } = make()
      editor.commands.focus('end')
      typeText(editor, `${typed}x`)
      expect(editor.getHTML(), typed).toContain('data-type="taskList"')
      destroy()
    }
    const { editor, destroy } = make()
    editor.commands.focus('end')
    typeText(editor, 'a **b** `c`')
    expect(editor.getHTML()).toContain('<strong>b</strong>')
    expect(editor.getHTML()).toContain('<code>c</code>')
    destroy()
  })
})

describe('code block', () => {
  it('keeps the language and renders highlight tokens', () => {
    const { editor, destroy } = createTestEditor({
      plugins: [textPlugin()],
      content: {
        type: 'doc',
        content: [
          { type: 'codeBlock', attrs: { language: 'javascript' }, content: [{ type: 'text', text: 'const a = 1' }] },
        ],
      },
    })
    expect(editor.getHTML()).toContain('language-javascript')
    expect(editor.getJSON().content?.[0]?.attrs?.language).toBe('javascript')
    destroy()
  })
})

describe('toggle', () => {
  it('wraps a block in a toggle embed via the operation', () => {
    const { editor, destroy } = createTestEditor({ plugins: [textPlugin(), togglePlugin], content: '<p>Title</p>' })
    editor.commands.setTextSelection(2)
    expect(setToggle.run(editor)).toBe(true)
    expect(editor.state.doc.firstChild?.type.name).toBe('embedBlock')
    expect(editor.state.doc.firstChild?.attrs.blockType).toBe('toggle')
    destroy()
  })
})
