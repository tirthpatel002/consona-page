// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { listsPlugin } from '../lists'
import { mediaPlugin } from '../media'
import { textPlugin } from '../text'
import { PasteConversion } from './paste'

class FakeClipboardEvent extends Event {}
vi.stubGlobal('ClipboardEvent', FakeClipboardEvent)

const HOSTILE = [
  '<p onclick="alert(1)">a <a href="javascript:alert(1)">l</a> <script>alert(2)</script></p>',
  '<figure data-type="media" data-kind="image"><div><img src="javascript:alert(3)" onerror="alert(4)"></div><figcaption>c</figcaption></figure>',
  '<p><span style="color:red;background:url(javascript:alert(5))">s</span></p>',
].join('')

describe('hostile HTML that claims to be an editor copy', () => {
  it('ends up without script, handlers or javascript: targets', () => {
    const { editor, destroy } = createTestEditor({
      plugins: [textPlugin(), listsPlugin, mediaPlugin, { id: 'paste', extensions: [PasteConversion] }],
      content: '<p>start</p>',
    })
    editor.view.pasteHTML(`<div data-pm-slice="0 0 []">${HOSTILE}</div>`)
    const html = editor.getHTML()
    expect(html).toContain('data-type="media"') // the paste really landed
    expect(html).not.toMatch(/javascript:|onclick|onerror|<script|alert\(/i)
    destroy()
  })
})
