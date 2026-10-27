// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTestEditor, isBlockId, plainHtml } from '../src/editor/core'
import { pagePlugins } from './plugins'
import type { Editor } from '@tiptap/core'

const idsOf = (editor: Editor): string[] => {
  const ids: string[] = []
  editor.state.doc.descendants((node) => {
    if (node.type.spec.attrs && 'blockId' in node.type.spec.attrs) ids.push(String(node.attrs.blockId))
  })
  return ids
}
const make = (content: string) => createTestEditor({ plugins: pagePlugins, content })

describe('block ids', () => {
  it('every block node type in the real plugin set carries a blockId attribute', () => {
    const { editor, destroy } = make('<p>x</p>')
    const missing = Object.values(editor.schema.nodes)
      .filter((t) => t.isBlock && t.name !== 'doc' && !t.spec.attrs?.blockId)
      .map((t) => t.name)
    expect(missing).toEqual([])
    destroy()
  })

  it('gives an old page unique ids on load, and they are valid', () => {
    const { editor, destroy } = make('<h2>t</h2><p>a</p><ul><li><p>one</p></li><li><p>two</p></li></ul>')
    const ids = idsOf(editor)
    expect(ids.length).toBeGreaterThan(5)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(isBlockId)).toBe(true)
    destroy()
  })

  it('keeps ids stable across typing, undo and moving a block', () => {
    const { editor, destroy } = make('<p>a</p><p>b</p><p>c</p>')
    const before = idsOf(editor).slice(0, 3)
    editor.commands.insertContentAt(2, 'X')
    expect(idsOf(editor).slice(0, 3)).toEqual(before)
    editor.commands.undo()
    expect(idsOf(editor).slice(0, 3)).toEqual(before)
    // move paragraph c before a: cut and paste at the start keeps its id
    const doc = editor.state.doc
    const c = doc.child(2)
    const tr = editor.state.tr.delete(doc.content.size - c.nodeSize - 0, doc.content.size).insert(0, c)
    editor.view.dispatch(tr)
    expect(idsOf(editor)).toContain(before[2])
    expect(new Set(idsOf(editor)).size).toBe(idsOf(editor).length)
    destroy()
  })

  it('gives a pasted copy a new id and leaves the original with its id', () => {
    const { editor, destroy } = make('<p>one</p><p>two</p>')
    const [first, second] = idsOf(editor)
    const copy = editor.state.doc.child(0)
    // paste a copy of the first paragraph BEFORE it (the copy comes first in document order)
    editor.view.dispatch(editor.state.tr.insert(0, copy))
    const ids = idsOf(editor)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[1]).toBe(first) // the original (now second) kept its id
    expect(ids[0]).not.toBe(first) // the copy got a new one
    expect(ids).toContain(second)
    destroy()
  })

  it('replaces malformed and duplicated ids coming from HTML', () => {
    const { editor, destroy } = make(
      '<p data-block-id="same-id-1">a</p><p data-block-id="same-id-1">b</p><p data-block-id="bad id!">c</p>',
    )
    const ids = idsOf(editor)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(isBlockId)).toBe(true)
    expect(ids[0]).toBe('same-id-1')
    destroy()
  })

  it('writes the id into the HTML for copies and strips cleanly for structure checks', () => {
    const { editor, destroy } = make('<p>hi</p>')
    expect(editor.getHTML()).toMatch(/data-block-id="b[a-z0-9]{9}"/)
    expect(plainHtml(editor)).toContain('<p>hi</p>')
    destroy()
  })

  it('keeps the original id on the first half when a block is split, and gives the second half a new one', () => {
    const { editor, destroy } = make('<p>hello world</p>')
    const [original] = idsOf(editor)
    editor.commands.setTextSelection(6)
    editor.commands.splitBlock()
    const ids = idsOf(editor)
    expect(ids[0]).toBe(original)
    expect(ids[1]).not.toBe(original)
    expect(new Set(ids).size).toBe(ids.length)
    destroy()
  })
})
