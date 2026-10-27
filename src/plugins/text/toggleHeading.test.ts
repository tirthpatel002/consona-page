// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTestEditor, isJsonObject } from '../../editor/core'
import { togglePlugin } from '../../blocks/toggle'
import { textPlugin } from '.'
import { setToggleHeading } from './operations'

const make = (content = '<p>Title</p>') => createTestEditor({ plugins: [textPlugin(), togglePlugin], content })

const toggleProps = (editor: ReturnType<typeof createTestEditor>['editor']) => {
  const node = editor.state.doc.firstChild
  if (node?.type.name !== 'embedBlock' || !isJsonObject(node.attrs.props)) return null
  return node.attrs.props
}

describe('toggle heading', () => {
  it('wraps the block in a toggle embed, as one undo step', () => {
    const { editor, destroy } = make()
    const before = editor.getJSON()
    editor.commands.setTextSelection(2)
    expect(setToggleHeading.run(editor, 2)).toBe(true)
    expect(editor.state.doc.firstChild?.type.name).toBe('embedBlock')
    expect(editor.state.doc.firstChild?.attrs.blockType).toBe('toggle')
    expect(toggleProps(editor)?.level).toBe(2)
    editor.commands.undo()
    expect(editor.getJSON()).toEqual(before)
    destroy()
  })

  it('changes level inside an existing toggle, and the same level turns it back to plain', () => {
    const { editor, destroy } = make()
    editor.commands.setTextSelection(2)
    setToggleHeading.run(editor, 1)
    editor.commands.setNodeSelection(0)
    setToggleHeading.run(editor, 3)
    expect(toggleProps(editor)?.level).toBe(3)
    setToggleHeading.run(editor, 3)
    expect(toggleProps(editor)?.level).toBe(null)
    destroy()
  })

  it('persists level in embed props through reload', () => {
    const { editor, destroy } = make()
    editor.commands.setTextSelection(2)
    setToggleHeading.run(editor, 2)
    editor.commands.setContent(editor.getHTML())
    expect(toggleProps(editor)?.level).toBe(2)
    destroy()
  })
})
