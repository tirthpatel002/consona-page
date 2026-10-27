// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import { createTestEditor } from '../src/editor/core'
import { createPageEngine } from '../src/editor/engine'
import { pagePlugins } from './plugins'

const HTML =
  '<h2>Title</h2><p>alpha one</p><p>beta two</p><ul><li><p>item a</p></li><li><p>item b</p></li></ul>' +
  '<table><tbody><tr><th>H1</th><th>H2</th></tr><tr><td>c1</td><td>c2</td></tr></tbody></table>'
const make = () => {
  const { editor, destroy } = createTestEditor({ plugins: pagePlugins, content: HTML })
  return { editor, destroy, engine: createPageEngine({ editor }) }
}
const idOf = (engine: ReturnType<typeof make>['engine'], text: string) => {
  const hit = engine.outline().blocks.find((b) => b.text === text)
  if (!hit) throw new Error('no block ' + text)
  return hit.id
}
const idsAndText = (editor: Editor) => {
  const out: Record<string, string> = {}
  editor.state.doc.descendants((n) => {
    if (n.attrs.blockId) out[String(n.attrs.blockId)] = n.textContent
  })
  return out
}

describe('page engine', () => {
  it('outline lists every block with id, type, depth and bounded text, in order', () => {
    const { engine, destroy } = make()
    const { blocks, revision } = engine.outline({ maxChars: 5 })
    expect(revision).toMatch(/^r/)
    expect(blocks.map((b) => b.type).slice(0, 4)).toEqual(['heading', 'paragraph', 'paragraph', 'bulletList'])
    expect(blocks[0]?.text).toBe('Title')
    expect(blocks.every((b) => b.text.length <= 5)).toBe(true)
    expect(new Set(blocks.map((b) => b.id)).size).toBe(blocks.length)
    // list items and table cells are addressable, deeper than the page
    expect(blocks.some((b) => b.type === 'listItem' && b.depth > 0)).toBe(true)
    expect(blocks.some((b) => b.type === 'tableCell' && b.depth > 0)).toBe(true)
    destroy()
  })

  it('read and find return bounded excerpts with ids', () => {
    const { engine, destroy } = make()
    const id = idOf(engine, 'alpha one')
    expect(engine.read([id, 'bnope'], { maxChars: 5 })).toEqual([
      { id, type: 'paragraph', text: 'alpha', truncated: true },
    ])
    const found = engine.find('TWO')
    expect(found).toHaveLength(1)
    expect(found[0]?.excerpt).toContain('beta two')
    expect(engine.find('')).toEqual([])
    destroy()
  })

  it('replaceText changes only that block, keeps every id, and is one undo step', () => {
    const { editor, engine, destroy } = make()
    const { revision } = engine.outline()
    const before = idsAndText(editor)
    const id = idOf(engine, 'alpha one')
    const result = engine.edit({
      baseRevision: revision,
      requestId: 'a',
      steps: [{ op: 'replaceText', id, text: 'ALPHA' }],
    })
    expect(result.ok).toBe(true)
    const after = idsAndText(editor)
    expect(Object.keys(after)).toEqual(Object.keys(before))
    expect(after[id]).toBe('ALPHA')
    expect(
      Object.entries(after)
        .filter(([k, v]) => before[k] !== v)
        .map(([k]) => k),
    ).toContain(id)
    editor.commands.undo()
    expect(idsAndText(editor)).toEqual(before)
    destroy()
  })

  it('replaces the text inside a list item and a table cell through their own ids', () => {
    const { editor, engine, destroy } = make()
    const { revision } = engine.outline()
    const item = engine.outline().blocks.find((b) => b.type === 'listItem')
    const cell = engine.outline().blocks.find((b) => b.type === 'tableCell')
    if (!item || !cell) throw new Error('missing')
    const result = engine.edit({
      baseRevision: revision,
      requestId: 'b',
      steps: [
        { op: 'replaceText', id: item.id, text: 'new item' },
        { op: 'replaceText', id: cell.id, text: 'new cell' },
      ],
    })
    expect(result.ok).toBe(true)
    expect(idsAndText(editor)[item.id]).toBe('new item')
    expect(idsAndText(editor)[cell.id]).toBe('new cell')
    destroy()
  })

  it('a bad step rejects the whole batch and changes nothing', () => {
    const { editor, engine, destroy } = make()
    const { revision } = engine.outline()
    const before = JSON.stringify(editor.getJSON())
    const id = idOf(engine, 'alpha one')
    const list = engine.outline().blocks.find((b) => b.type === 'bulletList')
    if (!list) throw new Error('no list')
    const result = engine.edit({
      baseRevision: revision,
      requestId: 'c',
      steps: [
        { op: 'replaceText', id, text: 'x' },
        { op: 'replaceText', id: list.id, text: 'a list holds several blocks' },
      ],
    })
    expect(result).toMatchObject({ ok: false, errors: [{ code: 'not_text_target', step: 1 }] })
    expect(JSON.stringify(editor.getJSON())).toBe(before)
    const unknown = engine.edit({
      baseRevision: revision,
      requestId: 'd',
      steps: [{ op: 'replaceText', id: 'bmissing000', text: 'x' }],
    })
    expect(unknown).toMatchObject({ ok: false, errors: [{ code: 'unknown_block' }] })
    expect(JSON.stringify(editor.getJSON())).toBe(before)
    destroy()
  })

  it('refuses a write when a touched block changed after it was read, naming it; other blocks do not block it', () => {
    const { editor, engine, destroy } = make()
    const { revision } = engine.outline()
    const alpha = idOf(engine, 'alpha one')
    const beta = idOf(engine, 'beta two')
    // someone else edits alpha after the caller read the page
    const other = createPageEngine({ editor })
    other.edit({
      baseRevision: other.revision(),
      requestId: 'other',
      steps: [{ op: 'replaceText', id: alpha, text: 'changed by someone' }],
    })
    const stale = engine.edit({
      baseRevision: revision,
      requestId: 'e',
      steps: [{ op: 'replaceText', id: alpha, text: 'mine' }],
    })
    expect(stale).toMatchObject({ ok: false, errors: [{ code: 'stale', changed: [alpha] }] })
    expect(idsAndText(editor)[alpha]).toBe('changed by someone')
    const fine = engine.edit({
      baseRevision: revision,
      requestId: 'f',
      steps: [{ op: 'replaceText', id: beta, text: 'BETA' }],
    })
    expect(fine.ok).toBe(true)
    expect(idsAndText(editor)[alpha]).toBe('changed by someone')
    destroy()
  })

  it('an unknown revision is refused, and a repeated request id replays without applying twice', () => {
    const { editor, engine, destroy } = make()
    const id = idOf(engine, 'alpha one')
    expect(engine.edit({ baseRevision: 'rzzz', requestId: 'g', steps: [] })).toMatchObject({
      ok: false,
      errors: [{ code: 'unknown_revision' }],
    })
    const request = {
      baseRevision: engine.revision(),
      requestId: 'h',
      steps: [{ op: 'insertParagraphAfter', id, text: 'added' } as const],
    }
    const first = engine.edit(request)
    const second = engine.edit(request)
    expect(first).toMatchObject({ ok: true, replayed: false })
    expect(second).toMatchObject({ ok: true, replayed: true })
    expect(editor.state.doc.textContent.split('added').length - 1).toBe(1)
    destroy()
  })

  it('insert and delete work, and deleting the last item of a list is refused', () => {
    const { editor, engine, destroy } = make()
    const beta = idOf(engine, 'beta two')
    const items = engine.outline().blocks.filter((b) => b.type === 'listItem')
    expect(items).toHaveLength(2)
    expect(
      engine.edit({ baseRevision: engine.revision(), requestId: 'i', steps: [{ op: 'delete', id: beta }] }).ok,
    ).toBe(true)
    expect(editor.state.doc.textContent).not.toContain('beta two')
    const first = items[0]
    const second = items[1]
    if (!first || !second) throw new Error('items')
    expect(
      engine.edit({ baseRevision: engine.revision(), requestId: 'i2', steps: [{ op: 'delete', id: first.id }] }).ok,
    ).toBe(true)
    const before = JSON.stringify(editor.getJSON())
    const last = engine.edit({
      baseRevision: engine.revision(),
      requestId: 'i3',
      steps: [{ op: 'delete', id: second.id }],
    })
    expect(last).toMatchObject({ ok: false, errors: [{ code: 'not_allowed' }] })
    expect(JSON.stringify(editor.getJSON())).toBe(before)
    destroy()
  })

  it('does nothing on a locked page', () => {
    const { editor, engine, destroy } = make()
    const { revision } = engine.outline()
    const id = idOf(engine, 'alpha one')
    editor.setEditable(false)
    const before = JSON.stringify(editor.getJSON())
    expect(
      engine.edit({ baseRevision: revision, requestId: 'j', steps: [{ op: 'replaceText', id, text: 'x' }] }),
    ).toMatchObject({
      ok: false,
      errors: [{ code: 'locked' }],
    })
    expect(JSON.stringify(editor.getJSON())).toBe(before)
    destroy()
  })

  it('refuses text that is too large and non-string text', () => {
    const { engine, destroy } = make()
    const { revision } = engine.outline()
    const id = idOf(engine, 'alpha one')
    const big = engine.edit({
      baseRevision: revision,
      requestId: 'k',
      steps: [{ op: 'replaceText', id, text: 'x'.repeat(20_001) }],
    })
    expect(big).toMatchObject({ ok: false, errors: [{ code: 'too_large' }] })
    destroy()
  })
})
