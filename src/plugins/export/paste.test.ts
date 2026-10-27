// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { listsPlugin } from '../lists'
import { textPlugin } from '../text'
import { CopyAsMarkdown, looksLikeMarkdown, markdownForSlice, pastedBlocks } from './paste'

describe('pastedBlocks', () => {
  it('converts external HTML and strips unsafe parts', () => {
    const blocks = pastedBlocks(
      '<h2>Hi</h2><p onclick="x()">a <a href="javascript:1">b</a></p><script>s()</script>',
      '',
    )
    const json = JSON.stringify(blocks)
    expect(json).toContain('"heading"')
    expect(json).not.toMatch(/javascript|onclick|s\(\)/)
  })
  it('leaves our own copies to ProseMirror', () => {
    expect(pastedBlocks('<p data-pm-slice="1 1 []">x</p>', 'x')).toBeNull()
  })
  it('converts markdown text but not prose', () => {
    expect(JSON.stringify(pastedBlocks('', '# T\n\n- a\n- b'))).toContain('bulletList')
    expect(pastedBlocks('', 'just a plain sentence\nsecond line')).toBeNull()
    expect(looksLikeMarkdown('one line **bold**')).toBe(false)
  })
})

describe('copy as Markdown', () => {
  const make = (content: string) =>
    createTestEditor({ plugins: [textPlugin(), listsPlugin, { id: 'copy', extensions: [CopyAsMarkdown] }], content })

  it('serializes whole blocks as Markdown', () => {
    const { editor, destroy } = make(
      '<h2>Title</h2><p>a <strong>b</strong> <a href="https://x.test">c</a></p><ul><li><p>one</p></li></ul>',
    )
    const text = markdownForSlice(editor.state.doc.slice(0, editor.state.doc.content.size))
    expect(text).toContain('## Title')
    expect(text).toContain('**b**')
    expect(text).toContain('[c](https://x.test)')
    expect(text).toMatch(/[-*] one/)
    destroy()
  })

  it('keeps plain text for a selection inside one paragraph, and is used by the editor on copy', () => {
    const { editor, destroy } = make('<p>hello <strong>world</strong></p>')
    editor.commands.setTextSelection({ from: 2, to: 8 })
    const { text } = editor.view.serializeForClipboard(editor.state.selection.content())
    expect(text).toBe('ello w')
    editor.commands.selectAll()
    expect(editor.view.serializeForClipboard(editor.state.selection.content()).text).toContain('hello **world**')
    destroy()
  })
})
