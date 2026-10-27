import type { Doc } from './types'

/** A tiny valid 1x1 transparent PNG, used by the fixture and docx image tests. */
export const PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

/**
 * One document covering every node and mark the converters support. Written so that
 * `fromHtml(toHtml(FIXTURE_DOC))` deep-equals FIXTURE_DOC (HTML is the lossless route).
 */
export const FIXTURE_DOC: Doc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Spec & "Plan"' }] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Details' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Plain ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'under', marks: [{ type: 'underline' }] },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'struck', marks: [{ type: 'strike' }] },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'code', marks: [{ type: 'code' }] },
        { type: 'text', text: ' ' },
        {
          type: 'text',
          text: 'linked',
          marks: [{ type: 'link', attrs: { href: 'https://example.com/spec' } }, { type: 'bold' }],
        },
        { type: 'text', text: ' ' },
        {
          type: 'text',
          text: 'tinted',
          marks: [{ type: 'textStyle', attrs: { color: 'rgb(51, 126, 169)', backgroundColor: 'rgb(219, 237, 219)' } }],
        },
        { type: 'hardBreak' },
        { type: 'text', text: 'after break' },
      ],
    },
    {
      type: 'bulletList',
      attrs: { marker: 'square' },
      content: [
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
            {
              type: 'bulletList',
              content: [
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested' }] }] },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'orderedList',
      attrs: { marker: 'lower-alpha' },
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }] },
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
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'pending' }] }],
        },
      ],
    },
    {
      type: 'blockquote',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'quoted <text>' }] }],
    },
    {
      type: 'codeBlock',
      attrs: { language: 'ts' },
      content: [{ type: 'text', text: 'const x = 1\nconsole.log(x)' }],
    },
    { type: 'horizontalRule' },
    {
      type: 'details',
      attrs: { open: true },
      content: [
        { type: 'detailsSummary', content: [{ type: 'text', text: 'More' }] },
        {
          type: 'detailsContent',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hidden body' }] }],
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
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name' }] }],
            },
            {
              type: 'tableHeader',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Value' }] }],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colspan: 2, rowspan: 1, colwidth: null },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'spans both' }] }],
            },
          ],
        },
      ],
    },
    {
      type: 'columnList',
      attrs: { layout: 'grid', tracks: 2 },
      content: [
        {
          type: 'column',
          attrs: { width: 0.75 },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'left tile' }] }],
        },
        {
          type: 'column',
          attrs: { width: 1.25 },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'right tile' }] }],
        },
      ],
    },
    {
      type: 'card',
      attrs: { tone: 'muted' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'card body' }] }],
    },
    {
      type: 'embedBlock',
      attrs: {
        blockType: 'callout',
        props: { variant: 'warning', title: 'Watch out', body: 'Careful with this step.' },
      },
    },
    {
      type: 'media',
      attrs: { kind: 'image', src: `data:image/png;base64,${PIXEL_PNG}`, width: 200, align: 'left' },
      content: [{ type: 'text', text: 'A pixel' }],
    },
    {
      type: 'media',
      attrs: { kind: 'video', src: 'https://example.com/clip.mp4', width: null, align: 'center' },
      content: [],
    },
  ],
}

/** Unknown node types still export their text (never silently dropped). */
export const UNKNOWN_NODE_DOC: Doc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'before' }] },
    { type: 'widget', attrs: { id: 7 }, content: [{ type: 'text', text: 'widget text' }] },
  ],
}
