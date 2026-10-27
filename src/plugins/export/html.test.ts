// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { FIXTURE_DOC, UNKNOWN_NODE_DOC } from './fixture'
import { fromHtml, toHtml } from './html'
import type { Doc } from './types'

describe('toHtml', () => {
  const html = toHtml(FIXTURE_DOC)

  it('emits a standalone styled document', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<style>')
    expect(html).toContain('<body class="page-export">')
  })

  it('serializes marks and escapes text', () => {
    expect(html).toContain('<h1>Spec &amp; &quot;Plan&quot;</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<u>under</u>')
    expect(html).toContain('<s>struck</s>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<a href="https://example.com/spec" rel="noopener noreferrer"><strong>linked</strong></a>')
    expect(html).toContain('<span style="color: rgb(51, 126, 169); background-color: rgb(219, 237, 219)">tinted</span>')
    expect(html).toContain('<br>after break')
    expect(html).toContain('quoted &lt;text&gt;')
  })

  it('serializes lists, tables, columns and toggles with schema data attributes', () => {
    expect(html).toContain('<ul data-marker="square">')
    expect(html).toContain('<ol data-marker="lower-alpha">')
    expect(html).toContain('<ul data-type="taskList">')
    expect(html).toContain('<li data-type="taskItem" data-checked="true">')
    expect(html).toContain('<td colspan="2">')
    expect(html).toContain('<div data-type="column-list" data-layout="grid"')
    expect(html).toContain('<div data-type="card" data-tone="muted" class="page-card">')
    expect(html).toContain('<div data-type="column" data-width="0.75"')
    expect(html).toContain('<details data-persist="true" open><summary>More</summary>')
    expect(html).toContain('<pre><code class="language-ts">const x = 1\nconsole.log(x)</code></pre>')
  })

  it('serializes callouts with props and media per the shared contract', () => {
    expect(html).toContain('data-block-type="callout"')
    expect(html).toContain('&quot;variant&quot;:&quot;warning&quot;')
    expect(html).toContain('Watch out')
    expect(html).toContain('<figure data-type="media" data-kind="image" data-align="left" data-width="200"')
    expect(html).toContain('<figcaption>A pixel</figcaption>')
    expect(html).toContain('data-kind="video" data-align="center"')
    expect(html).toContain('<video src="https://example.com/clip.mp4" controls></video>')
  })

  it('keeps unknown node text', () => {
    expect(toHtml(UNKNOWN_NODE_DOC)).toContain('widget text')
  })
})

describe('fromHtml', () => {
  it('round-trips the full fixture losslessly', () => {
    expect(fromHtml(toHtml(FIXTURE_DOC))).toEqual(FIXTURE_DOC)
  })

  it('maps common foreign HTML: checkbox lists, img tags, styled spans', () => {
    const doc = fromHtml(
      '<h2>Hi</h2><ul><li><input type="checkbox" checked> done</li><li><input type="checkbox"> later</li></ul>' +
        '<p><img src="https://example.com/x.png"></p>' +
        '<p><span style="color: rgb(255, 0, 0)">red</span></p>',
    )
    const types = (doc.content ?? []).map((node) => node.type)
    expect(types).toEqual(['heading', 'taskList', 'media', 'paragraph'])
    const tasks = doc.content?.[1]
    expect(tasks?.content?.[0].attrs).toEqual({ checked: true })
    expect(tasks?.content?.[1].attrs).toEqual({ checked: false })
    const image = doc.content?.[2]
    expect(image?.attrs).toMatchObject({ kind: 'image', src: 'https://example.com/x.png' })
    const red = doc.content?.[3].content?.[0]
    expect(red?.marks?.[0]).toEqual({ type: 'textStyle', attrs: { color: 'rgb(255, 0, 0)' } })
  })

  it('flattens unknown containers instead of dropping their content', () => {
    const doc = fromHtml('<section><article><p>nested text</p></article></section>')
    expect(doc.content?.[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'nested text' }],
    })
  })

  it('parses the media figure shape the editor itself renders', () => {
    // Matches the media node's renderHTML: resize span inside the frame, caption in figcaption.
    const doc: Doc = fromHtml(
      '<figure data-type="media" data-kind="video" data-align="right" data-width="320" class="page-media" style="width: 320px">' +
        '<div class="page-media__frame" contenteditable="false"><video src="https://example.com/v.mp4" controls="" preload="metadata"></video><span class="page-media__resize"></span></div>' +
        '<figcaption class="page-media__caption">a <strong>clip</strong></figcaption></figure>',
    )
    expect(doc.content?.[0]).toEqual({
      type: 'media',
      attrs: { kind: 'video', src: 'https://example.com/v.mp4', width: 320, align: 'right' },
      content: [
        { type: 'text', text: 'a ' },
        { type: 'text', text: 'clip', marks: [{ type: 'bold' }] },
      ],
    })
  })
})

describe('toHtml style values', () => {
  const doc = (attrs: Record<string, string>): Doc => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'textStyle', attrs }] }] }],
  })

  it('cannot break out of the style attribute or add markup', () => {
    const html = toHtml(
      doc({ color: 'red" onmouseover="alert(1)', backgroundColor: 'red;"><img src=x onerror=alert(1)>' }),
      {
        standalone: false,
      },
    )
    expect(html).not.toContain('onmouseover')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('style=')
  })

  it('drops non-color values and keeps plain colors', () => {
    const html = toHtml(doc({ color: 'url(https://example.com/x)', backgroundColor: '#ff0000' }), { standalone: false })
    expect(html).not.toContain('url(')
    expect(html).toContain('background-color: #ff0000')
  })
})
