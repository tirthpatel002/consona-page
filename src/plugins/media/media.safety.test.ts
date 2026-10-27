// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { textPlugin } from '../text'
import { mediaPlugin } from './index'

const figure = (src: string) =>
  `<figure data-type="media" data-kind="image"><div><img src="${src}"></div><figcaption>c</figcaption></figure>`

describe('media source safety at the schema', () => {
  const make = (content: string) => createTestEditor({ plugins: [textPlugin(), mediaPlugin], content })
  const srcs = (json: unknown): string[] => {
    const out: string[] = []
    const walk = (n: { type?: string; attrs?: { src?: string }; content?: unknown[] }): void => {
      if (n.type === 'media') out.push(String(n.attrs?.src))
      n.content?.forEach((c) => walk(c as typeof n))
    }
    walk(json as Parameters<typeof walk>[0])
    return out
  }

  it('drops a javascript: source when HTML is parsed', () => {
    const { editor, destroy } = make(figure('javascript:alert(1)'))
    expect(srcs(editor.getJSON())).toEqual([''])
    destroy()
  })

  it('keeps an https source', () => {
    const { editor, destroy } = make(figure('https://example.com/a.png'))
    expect(srcs(editor.getJSON())).toEqual(['https://example.com/a.png'])
    destroy()
  })

  it('never renders an unsafe source even when set from JSON', () => {
    const { editor, destroy } = make('<p>x</p>')
    editor.commands.setContent({
      type: 'doc',
      content: [{ type: 'media', attrs: { kind: 'image', src: 'javascript:alert(1)' }, content: [] }],
    })
    expect(editor.getHTML()).not.toContain('javascript')
    destroy()
  })
})
