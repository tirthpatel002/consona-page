// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { textPlugin } from './index'

describe('link targets at the schema', () => {
  it('does not keep a javascript: href parsed from HTML', () => {
    const { editor, destroy } = createTestEditor({
      plugins: [textPlugin()],
      content: '<p><a href="javascript:alert(1)">x</a> <a href="https://example.com">y</a></p>',
    })
    const html = editor.getHTML()
    expect(html).not.toContain('javascript')
    expect(html).toContain('https://example.com')
    destroy()
  })
  it('does not render a javascript: href set from JSON', () => {
    const { editor, destroy } = createTestEditor({ plugins: [textPlugin()], content: '<p>x</p>' })
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }],
        },
      ],
    })
    expect(editor.getHTML()).not.toContain('javascript')
    destroy()
  })
})
