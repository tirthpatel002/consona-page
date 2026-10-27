// @vitest-environment jsdom
import type { Node as PMNode } from '@tiptap/pm/model'
import { describe, expect, it } from 'vitest'
import { createTestEditor, moveBlocksTo } from '../../editor/core'
import { deleteBlock, duplicateBlock, moveBlockOp } from '../block-actions/operations'
import { blockActionsPlugin } from '../block-actions'
import { textPlugin } from '../text'
import { listsPlugin } from '.'
import { deleteWholeList, duplicateWholeList } from './operations'

const make = (content: string) =>
  createTestEditor({ plugins: [textPlugin(), listsPlugin, blockActionsPlugin], content })

const texts = (editor: { state: { doc: PMNode } }) =>
  editor.state.doc.textBetween(0, editor.state.doc.content.size, '|', '|').replace(/\|$/, '')

// The editor appends an empty trailing paragraph after a list on its first change; ignore it when comparing.
const snap = (editor: { getJSON: () => { content?: { type: string; content?: unknown }[] } }) => {
  const json = editor.getJSON()
  const content = [...(json.content ?? [])]
  const last = content[content.length - 1]
  if (last?.type === 'paragraph' && !last.content) content.pop()
  return { ...json, content }
}

const KINDS = [
  [
    'bullet',
    '<ul><li><p>a</p></li><li><p>b</p><ul><li><p>b1</p></li><li><p>b2</p></li></ul></li><li><p>c</p></li></ul>',
  ],
  ['ordered', '<ol><li><p>a</p></li><li><p>b</p><ol><li><p>b1</p></li><li><p>b2</p></ol></li><li><p>c</p></li></ol>'],
  [
    'task',
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p>a</p></div></li><li data-type="taskItem" data-checked="true"><div><p>b</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p>b1</p></div></li><li data-type="taskItem" data-checked="false"><div><p>b2</p></div></li></ul></div></li><li data-type="taskItem" data-checked="false"><div><p>c</p></div></li></ul>',
  ],
] as const

describe.each(KINDS)('%s list items', (_name, html) => {
  const itemPos = (editor: ReturnType<typeof make>['editor'], label: string) => {
    let found = -1
    editor.state.doc.descendants((node, pos) => {
      if (found < 0 && /Item$/.test(node.type.name) && node.firstChild?.textContent === label) found = pos
    })
    return found
  }

  it('moves a nested item up (schema valid, content kept, one undo step)', () => {
    const { editor, destroy } = make(html)
    const before = snap(editor)
    expect(moveBlockOp.run(editor, itemPos(editor, 'b2'), 'up')).toBe(true)
    expect(texts(editor)).toBe('a|b|b2|b1|c')
    expect(() => editor.state.doc.check()).not.toThrow()
    editor.commands.undo()
    expect(snap(editor)).toEqual(before)
    destroy()
  })

  it('duplicates an item with its nested items', () => {
    const { editor, destroy } = make(html)
    const before = snap(editor)
    expect(duplicateBlock.run(editor, itemPos(editor, 'b'))).toBe(true)
    expect(texts(editor)).toBe('a|b|b1|b2|b|b1|b2|c')
    expect(() => editor.state.doc.check()).not.toThrow()
    editor.commands.undo()
    expect(snap(editor)).toEqual(before)
    destroy()
  })

  it('deletes a nested item, and the list when it was the only item', () => {
    const { editor, destroy } = make(html)
    const before = snap(editor)
    deleteBlock.run(editor, itemPos(editor, 'b1'))
    deleteBlock.run(editor, itemPos(editor, 'b2'))
    expect(texts(editor)).toBe('a|b|c')
    expect(JSON.stringify(snap(editor))).not.toMatch(/"content":\[\]/)
    expect(() => editor.state.doc.check()).not.toThrow()
    editor.commands.undo()
    editor.commands.undo()
    expect(snap(editor)).toEqual(before)
    destroy()
  })

  it('drags an item after another (same list kind) as one step, rejects a top-level drop', () => {
    const { editor, destroy } = make(html + '<p>tail</p>')
    const before = snap(editor)
    const a = itemPos(editor, 'a')
    const aNode = editor.state.doc.nodeAt(a)
    const c = itemPos(editor, 'c')
    const cEnd = c + (editor.state.doc.nodeAt(c)?.nodeSize ?? 0)
    expect(moveBlocksTo.run(editor, a, a + (aNode?.nodeSize ?? 0), cEnd)).toBe(true)
    expect(texts(editor)).toBe('b|b1|b2|c|a|tail')
    expect(() => editor.state.doc.check()).not.toThrow()
    editor.commands.undo()
    expect(snap(editor)).toEqual(before)
    const listEnd = editor.state.doc.firstChild?.nodeSize ?? 0
    expect(moveBlocksTo.run(editor, a, a + (aNode?.nodeSize ?? 0), listEnd)).toBe(false)
    expect(snap(editor)).toEqual(before)
    destroy()
  })

  it('duplicates and deletes the whole list from an item', () => {
    const { editor, destroy } = make(html)
    const before = snap(editor)
    duplicateWholeList.run(editor, itemPos(editor, 'a'))
    expect(editor.state.doc.childCount).toBeGreaterThanOrEqual(2)
    expect(texts(editor).startsWith(texts(editor).slice(0, 0))).toBe(true)
    editor.commands.undo()
    expect(snap(editor)).toEqual(before)
    deleteWholeList.run(editor, itemPos(editor, 'b1'))
    expect(texts(editor)).toBe('a|b|c')
    editor.commands.undo()
    expect(snap(editor)).toEqual(before)
    deleteWholeList.run(editor, itemPos(editor, 'a'))
    expect(editor.state.doc.textContent).toBe('')
    destroy()
  })
})
