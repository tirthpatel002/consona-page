import { describe, expect, it } from 'vitest'
import { FIXTURE_DOC, PIXEL_PNG, UNKNOWN_NODE_DOC } from './fixture'
import { fromMarkdown, inlineToMarkdown, parseInline, toMarkdown } from './markdown'
import { textOf, type Doc } from './types'

describe('toMarkdown', () => {
  const md = toMarkdown(FIXTURE_DOC)

  it('serializes headings, marks and hard breaks', () => {
    expect(md).toContain('# Spec & "Plan"')
    expect(md).toContain('### Details')
    expect(md).toContain('**bold**')
    expect(md).toContain('*italic*')
    expect(md).toContain('<u>under</u>')
    expect(md).toContain('~~struck~~')
    expect(md).toContain('`code`')
    expect(md).toContain('[**linked**](https://example.com/spec)')
    expect(md).toContain('after break')
    expect(md).toContain('  \n')
  })

  it('serializes lists including nesting, markers and tasks', () => {
    expect(md).toContain('- first')
    expect(md).toContain('  - nested')
    expect(md).toContain('1. one')
    expect(md).toContain('2. two')
    expect(md).toContain('- [x] done')
    expect(md).toContain('- [ ] pending')
  })

  it('serializes quote, code fence, rule, table, callout and media', () => {
    expect(md).toContain('> quoted \\<text\\>')
    expect(md).toContain('```ts\nconst x = 1\nconsole.log(x)\n```')
    expect(md).toContain('---')
    expect(md).toContain('| Name | Value |')
    expect(md).toContain('| --- | --- |')
    expect(md).toContain('| spans both |')
    expect(md).toContain('> **Watch out**')
    expect(md).toContain('> Careful with this step.')
    expect(md).toContain(`![A pixel](data:image/png;base64,${PIXEL_PNG})`)
    expect(md).toContain('<video src="https://example.com/clip.mp4"></video>')
  })

  it('flattens columns but keeps their text', () => {
    expect(md).toContain('left tile')
    expect(md).toContain('right tile')
  })

  it('documents the toggle as a bold summary line', () => {
    expect(md).toContain('**▸ More**')
    expect(md).toContain('hidden body')
  })

  it('never drops unknown node text', () => {
    expect(toMarkdown(UNKNOWN_NODE_DOC)).toContain('widget text')
  })
})

describe('parseInline', () => {
  it('parses combined marks and links', () => {
    expect(parseInline('a **b** `c` [d](https://x.y) ~~s~~ <u>u</u>')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'text', text: 'b', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'c', marks: [{ type: 'code' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'd', marks: [{ type: 'link', attrs: { href: 'https://x.y' } }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 's', marks: [{ type: 'strike' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'u', marks: [{ type: 'underline' }] },
    ])
  })

  it('round-trips escaped characters', () => {
    expect(inlineToMarkdown(parseInline('escaped \\*star\\* and \\[bracket\\]'))).toBe(
      'escaped \\*star\\* and \\[bracket\\]',
    )
  })
})

describe('fromMarkdown', () => {
  it('parses headings, nested lists, tasks, quotes, tables, code and rules', () => {
    const doc = fromMarkdown(
      [
        '# Title',
        '',
        '## Sub',
        '',
        '- a',
        '  - a.1',
        '- b',
        '',
        '1. first',
        '2. second',
        '',
        '- [x] done',
        '- [ ] todo',
        '',
        '> quoted line',
        '',
        '| H1 | H2 |',
        '| --- | --- |',
        '| c1 | c2 |',
        '',
        '```js',
        'let a = 1',
        '```',
        '',
        '---',
        '',
        '![alt](https://example.com/a.png)',
        '',
        'para with **bold** and',
        'a second line',
      ].join('\n'),
    )
    const types = (doc.content ?? []).map((node) => node.type)
    expect(types).toEqual([
      'heading',
      'heading',
      'bulletList',
      'orderedList',
      'taskList',
      'blockquote',
      'table',
      'codeBlock',
      'horizontalRule',
      'media',
      'paragraph',
    ])
    const bullet = doc.content?.[2]
    expect(bullet?.content?.[0].content?.[1]?.type).toBe('bulletList')
    const tasks = doc.content?.[4]
    expect(tasks?.content?.[0].attrs).toEqual({ checked: true })
    expect(tasks?.content?.[1].attrs).toEqual({ checked: false })
    const table = doc.content?.[6]
    expect(table?.content?.[0].content?.[0].type).toBe('tableHeader')
    expect(table?.content?.[1].content?.[0].type).toBe('tableCell')
    const code = doc.content?.[7]
    expect(code?.attrs).toEqual({ language: 'js' })
    const media = doc.content?.[9]
    expect(media?.attrs).toMatchObject({ kind: 'image', src: 'https://example.com/a.png' })
    const paragraph = doc.content?.[10]
    expect(paragraph?.content?.some((node) => node.type === 'hardBreak')).toBe(true)
  })

  it('splits adjacent lists of different kinds', () => {
    const doc = fromMarkdown('- bullet\n1. numbered\n- [ ] task\n')
    expect((doc.content ?? []).map((node) => node.type)).toEqual(['bulletList', 'orderedList', 'taskList'])
  })
})

describe('markdown round trip', () => {
  it('preserves plain text of the representable subset', () => {
    const subset: Doc = {
      type: 'doc',
      content: (FIXTURE_DOC.content ?? []).filter((node) =>
        ['heading', 'paragraph', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock'].includes(
          node.type,
        ),
      ),
    }
    const roundTripped = fromMarkdown(toMarkdown(subset))
    expect(textOf(roundTripped).replace(/\s+/g, ' ').trim()).toBe(textOf(subset).replace(/\s+/g, ' ').trim())
  })
})
