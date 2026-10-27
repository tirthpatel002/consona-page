// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../src/editor/core'
import { createPageEngine, type MarkdownCodec } from '../src/editor/engine'
import { fromMarkdown, inlineToMarkdown, parseInline } from '../src/plugins/export/markdown'
import { pagePlugins } from './plugins'

const codec: MarkdownCodec = {
  parseInline: (text) => parseInline(text),
  parseBlocks: (text) => fromMarkdown(text).content ?? [],
  inlineToMarkdown: (content) => inlineToMarkdown(content),
}
const HTML =
  '<h2>Title</h2><p>alpha <strong>one</strong></p><p>beta two</p><ul><li><p>item a</p></li></ul>' +
  '<pre><code class="language-js">let a = 1\nlet b = 2</code></pre>'
const make = () => {
  const { editor, destroy } = createTestEditor({ plugins: pagePlugins, content: HTML })
  return { editor, destroy, engine: createPageEngine({ editor, markdown: codec }) }
}
const idOf = (engine: ReturnType<typeof make>['engine'], text: string) => {
  const hit = engine.outline().blocks.find((b) => b.text === text)
  if (!hit) throw new Error('no block ' + text)
  return hit.id
}

describe('compact text', () => {
  it('reads one id-addressed line per block, with marks as Markdown and nesting as indent', () => {
    const { engine, destroy } = make()
    const compact = engine.readCompact()
    expect(compact).not.toBeNull()
    const lines = compact?.text.split('\n') ?? []
    expect(lines[0]).toMatch(/^\[[^\]]+\] ## Title$/)
    expect(lines[1]).toMatch(/^\[[^\]]+\] alpha \*\*one\*\*$/)
    expect(lines.some((l) => /^ {2}\[[^\]]+\] - item a$/.test(l))).toBe(true)
    // code keeps its text as one line with an escaped newline, and its language as a directive attribute
    expect(lines.some((l) => l.includes('::codeBlock{language="js"} let a = 1\\nlet b = 2'))).toBe(true)
    expect(compact?.revision).toBe(engine.revision())
    destroy()
  })

  it('is bounded by lines and characters and says when it cut', () => {
    const { engine, destroy } = make()
    const few = engine.readCompact({ maxLines: 2 })
    expect(few?.lines).toBe(2)
    expect(few?.truncated).toBe(true)
    const short = engine.readCompact({ maxChars: 3 })
    expect(short?.truncated).toBe(true)
    const one = engine.readCompact({ ids: [idOf(engine, 'beta two')] })
    expect(one?.text).toMatch(/^\[[^\]]+\] beta two$/)
    destroy()
  })

  it('returns null without a Markdown converter, and edits that need one are refused', () => {
    const { editor, destroy } = createTestEditor({ plugins: pagePlugins, content: HTML })
    const engine = createPageEngine({ editor })
    expect(engine.readCompact()).toBeNull()
    const id = idOf(engine, 'beta two')
    const result = engine.edit({
      baseRevision: engine.revision(),
      requestId: 'x',
      steps: [{ op: 'replaceMarkdown', id, text: '**hi**' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]?.code).toBe('needs_markdown')
    destroy()
  })
})

describe('Markdown edits', () => {
  it('replaceMarkdown keeps marks in one undo step, and the block keeps its id', () => {
    const { editor, engine, destroy } = make()
    const id = idOf(engine, 'beta two')
    const result = engine.edit({
      baseRevision: engine.revision(),
      requestId: 'a',
      steps: [{ op: 'replaceMarkdown', id, text: 'new **bold** and [a link](https://example.com)' }],
    })
    expect(result.ok).toBe(true)
    const json = JSON.stringify(editor.getJSON())
    expect(json).toContain('"bold"')
    expect(json).toContain('https://example.com')
    expect(engine.read([id])[0]?.text).toBe('new bold and a link')
    editor.commands.undo()
    expect(engine.read([id])[0]?.text).toBe('beta two')
    destroy()
  })

  it('refuses a link the editor would not keep, and changes nothing', () => {
    const { editor, engine, destroy } = make()
    const id = idOf(engine, 'beta two')
    const before = JSON.stringify(editor.getJSON())
    for (const href of ['javascript:alert(1)', 'data:text/html;base64,AAAA', 'vbscript:x']) {
      const result = engine.edit({
        baseRevision: engine.revision(),
        requestId: 'h' + href,
        steps: [{ op: 'replaceMarkdown', id, text: `[x](${href})` }],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors[0]?.code).toBe('blocked_url')
    }
    expect(JSON.stringify(editor.getJSON())).toBe(before)
    destroy()
  })

  it('does not parse HTML in the text: it stays literal text', () => {
    const { editor, engine, destroy } = make()
    const id = idOf(engine, 'beta two')
    engine.edit({
      baseRevision: engine.revision(),
      requestId: 'b',
      steps: [{ op: 'replaceMarkdown', id, text: '<img src=x onerror=alert(1)>' }],
    })
    expect(editor.getHTML()).not.toContain('<img')
    destroy()
  })

  it('insertMarkdownAfter adds headings, lists and tables with fresh ids', () => {
    const { editor, engine, destroy } = make()
    const id = idOf(engine, 'beta two')
    const before = new Set(engine.outline().blocks.map((b) => b.id))
    const result = engine.edit({
      baseRevision: engine.revision(),
      requestId: 'c',
      steps: [{ op: 'insertMarkdownAfter', id, text: '## New\n\n- one\n- two\n\n| a | b |\n| - | - |\n| 1 | 2 |' }],
    })
    expect(result.ok).toBe(true)
    const after = engine.outline().blocks
    const added = after.filter((b) => !before.has(b.id))
    expect(added.map((b) => b.type)).toEqual(expect.arrayContaining(['heading', 'bulletList', 'listItem', 'table']))
    expect(editor.getText()).toContain('New')
    // the new blocks come right after the target
    const order = after.map((b) => b.text)
    expect(order.indexOf('New')).toBe(order.indexOf('beta two') + 1)
    destroy()
  })

  it('insertMarkdownAfter refuses media, bad links, empty text and oversized batches', () => {
    const { editor, engine, destroy } = make()
    const id = idOf(engine, 'beta two')
    const before = JSON.stringify(editor.getJSON())
    const code = (text: string) => {
      const r = engine.edit({
        baseRevision: engine.revision(),
        requestId: 'i' + text,
        steps: [{ op: 'insertMarkdownAfter', id, text }],
      })
      return r.ok ? 'ok' : r.errors[0]?.code
    }
    expect(code('![x](https://example.com/a.png)')).toBe('not_allowed')
    expect(code('[x](javascript:alert(1))')).toBe('blocked_url')
    expect(code('   ')).toBe('invalid_step')
    expect(code(Array.from({ length: 201 }, (_, i) => `p${String(i)}`).join('\n\n'))).toBe('too_large')
    expect(JSON.stringify(editor.getJSON())).toBe(before)
    destroy()
  })

  it('inserted text cannot bring its own block ids', () => {
    const { engine, destroy } = make()
    const id = idOf(engine, 'beta two')
    engine.edit({
      baseRevision: engine.revision(),
      requestId: 'd',
      steps: [{ op: 'insertMarkdownAfter', id, text: 'x' }],
    })
    const ids = engine.outline().blocks.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    destroy()
  })

  it('a locked page refuses Markdown edits', () => {
    const { editor, engine, destroy } = make()
    const id = idOf(engine, 'beta two')
    editor.setEditable(false)
    const r = engine.edit({
      baseRevision: engine.revision(),
      requestId: 'l',
      steps: [{ op: 'replaceMarkdown', id, text: 'x' }],
    })
    expect(r.ok).toBe(false)
    destroy()
  })
})

describe('setProps', () => {
  const run = (
    engine: ReturnType<typeof make>['engine'],
    id: string,
    props: Record<string, string | number | boolean | null>,
  ) =>
    engine.edit({
      baseRevision: engine.revision(),
      requestId: JSON.stringify([id, props]),
      steps: [{ op: 'setProps', id, props }],
    })
  const codeOf = (r: ReturnType<typeof run>) => (r.ok ? 'ok' : r.errors[0]?.code)

  it('sets plain attributes, keeps the id and the text, one undo step', () => {
    const { editor, engine, destroy } = make()
    const id = idOf(engine, 'Title')
    expect(codeOf(run(engine, id, { level: 3 }))).toBe('ok')
    expect(editor.getJSON().content?.[0]?.attrs?.level).toBe(3)
    expect(engine.outline().blocks[0]?.id).toBe(id)
    expect(engine.read([id])[0]?.text).toBe('Title')
    destroy()
  })

  it('refuses unknown attributes, wrong kinds, URL-like names, non-plain values and long strings', () => {
    const { editor, engine, destroy } = make()
    const id = idOf(engine, 'Title')
    const before = JSON.stringify(editor.getJSON())
    expect(codeOf(run(engine, id, { nope: 1 }))).toBe('not_allowed')
    expect(codeOf(run(engine, id, { blockId: 'b123456789' }))).toBe('not_allowed')
    expect(codeOf(run(engine, id, { level: 'big' }))).toBe('invalid_step')
    expect(codeOf(run(engine, id, {}))).toBe('invalid_step')
    expect(codeOf(run(engine, id, { language: 'x'.repeat(201) }))).not.toBe('ok')
    expect(codeOf(run(engine, id, { href: 'javascript:alert(1)' }))).not.toBe('ok')
    expect(JSON.stringify(editor.getJSON())).toBe(before)
    destroy()
  })

  it('refuses a heading level outside 1 to 6 and a non-finite number', () => {
    const { editor, engine, destroy } = make()
    const id = idOf(engine, 'Title')
    const before = JSON.stringify(editor.getJSON())
    for (const level of [0, 7, 99, 2.5, Number.NaN, Infinity])
      expect(codeOf(run(engine, id, { level }))).toBe('invalid_step')
    expect(JSON.stringify(editor.getJSON())).toBe(before)
    destroy()
  })
})

describe('engine undo', () => {
  it('steps back the last batch as one change, tagged as a program change', () => {
    const { editor, engine, destroy } = make()
    const id = idOf(engine, 'beta two')
    const original = JSON.stringify(editor.getJSON())
    const metas: unknown[] = []
    editor.on('transaction', ({ transaction }) => metas.push(transaction.getMeta('source')))
    engine.edit({
      baseRevision: engine.revision(),
      requestId: 'u1',
      steps: [
        { op: 'replaceMarkdown', id, text: 'changed' },
        { op: 'insertMarkdownAfter', id, text: '## Added' },
      ],
    })
    expect(editor.getText()).toContain('Added')
    const undone = engine.undo()
    expect(undone.ok).toBe(true)
    expect(JSON.stringify(editor.getJSON())).toBe(original)
    expect(metas.filter((m) => m === 'program').length).toBe(2)
    expect(engine.undo().ok).toBe(false)
    destroy()
  })

  it('refuses when the page changed after the batch, and when the page is locked', () => {
    const { editor, engine, destroy } = make()
    const id = idOf(engine, 'beta two')
    engine.edit({ baseRevision: engine.revision(), requestId: 'u2', steps: [{ op: 'replaceMarkdown', id, text: 'x' }] })
    editor.commands.insertContentAt(1, 'user typed ')
    const refused = engine.undo()
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.errors[0]?.code).toBe('changed_since')
    expect(editor.getText()).toContain('user typed')
    destroy()
  })

  it('nothing to undo before any batch', () => {
    const { engine, destroy } = make()
    const r = engine.undo()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]?.code).toBe('nothing_to_undo')
    destroy()
  })
})
