// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { cardPlugin } from '.'
import { insertCard, setCardTone, unwrapCard } from './operations'

const make = (content = '<p></p>') =>
  createTestEditor({ plugins: [{ id: 'text', extensions: [StarterKit] }, cardPlugin], content })
const json = (e: ReturnType<typeof make>['editor']) => {
  const doc = e.getJSON()
  const content = [...(doc.content ?? [])]
  const last = content[content.length - 1]
  if (last?.type === 'paragraph' && !last.content) content.pop()
  return { ...doc, content }
}

describe('card block', () => {
  it('inserts with the caret inside, accepts typing and undoes as one step', () => {
    const { editor, destroy } = make('<p>keep</p>')
    const before = json(editor)
    editor.commands.setTextSelection(2)
    expect(insertCard.run(editor)).toBe(true)
    editor.commands.insertContent('inside')
    expect(editor.state.doc.child(1).type.name).toBe('card')
    expect(editor.state.doc.child(1).textContent).toBe('inside')
    editor.commands.undo()
    editor.commands.undo()
    expect(json(editor)).toEqual(before)
    destroy()
  })

  it('does not nest cards, changes tone, and unwrap keeps every block', () => {
    const { editor, destroy } = make('<div data-type="card"><p>A</p><ul><li><p>B</p></li></ul></div>')
    editor.commands.setTextSelection(3)
    expect(insertCard.run(editor)).toBe(false)
    expect(setCardTone.run(editor, 0, 'plain')).toBe(false)
    expect(setCardTone.run(editor, 0, 'accent')).toBe(true)
    expect(editor.getHTML()).toContain('data-tone="accent"')
    expect(unwrapCard.run(editor, 0)).toBe(true)
    expect(editor.state.doc.content.content.map((n) => n.type.name).slice(0, 2)).toEqual(['paragraph', 'bulletList'])
    expect(editor.state.doc.textContent).toContain('AB')
    editor.commands.undo()
    expect(editor.state.doc.firstChild?.type.name).toBe('card')
    destroy()
  })

  it('round-trips through HTML', () => {
    const { editor, destroy } = make('<div data-type="card" data-tone="muted"><p>x</p></div>')
    editor.commands.setContent(editor.getHTML())
    expect(editor.state.doc.firstChild?.attrs.tone).toBe('muted')
    destroy()
  })
})
