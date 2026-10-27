// @vitest-environment jsdom
import type { Content } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { calloutPlugin, tablePlugin } from '../../blocks'
import { createTestEditor } from '../../editor/core'
import { columnsPlugin } from '../columns'
import { formattingPlugin } from '../formatting'
import { listsPlugin } from '../lists'
import { textPlugin } from '../text'
import { fromHtml, toHtml } from './html'
import { fromMarkdown, toMarkdown } from './markdown'
import { textOf, type Doc } from './types'

const plugins = [textPlugin(), formattingPlugin, listsPlugin, columnsPlugin, calloutPlugin, tablePlugin]

/** Fixture subset the current schema knows (media lands in a later commit on the main branch). */
const SCHEMA_DOC: Doc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Round trip' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Some ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' and ' },
        { type: 'text', text: 'a link', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }],
        },
      ],
    },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H' }] }],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'C' }] }],
            },
          ],
        },
      ],
    },
    {
      type: 'columnList',
      attrs: { layout: 'columns' },
      content: [
        {
          type: 'column',
          attrs: { width: 1 },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'col one' }] }],
        },
        {
          type: 'column',
          attrs: { width: 2 },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'col two' }] }],
        },
      ],
    },
    {
      type: 'embedBlock',
      attrs: { blockType: 'callout', props: { variant: 'info', title: 'Note', body: 'Read me' } },
    },
  ],
}

describe('schema round trips', () => {
  it('fromHtml output is accepted by the real schema and preserves text', () => {
    const source = createTestEditor({ plugins, content: SCHEMA_DOC as unknown as Content })
    const html = toHtml(source.editor.getJSON() as unknown as Doc)
    const imported = fromHtml(html)
    const target = createTestEditor({ plugins, content: imported as unknown as Content })
    expect(textOf(target.editor.getJSON() as unknown as Doc)).toBe(textOf(source.editor.getJSON() as unknown as Doc))
    expect(textOf(imported)).toContain('col one')
    const callout = (imported.content ?? []).find((node) => node.type === 'embedBlock')
    expect(callout?.attrs?.blockType).toBe('callout')
    expect(callout?.attrs?.props).toMatchObject({ title: 'Note', body: 'Read me' })
    source.destroy()
    target.destroy()
  })

  it('fromMarkdown output is accepted by the real schema', () => {
    const markdown = toMarkdown(SCHEMA_DOC)
    const imported = fromMarkdown(markdown)
    const target = createTestEditor({ plugins, content: imported as unknown as Content })
    const text = textOf(target.editor.getJSON() as unknown as Doc)
    for (const expected of ['Round trip', 'bold', 'a link', 'done', 'H', 'C', 'col one', 'col two', 'Read me']) {
      expect(text).toContain(expected)
    }
    target.destroy()
  })
})
