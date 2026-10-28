// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it, vi } from 'vitest'
import { blockSelectionPluginKey, createTestEditor } from '../../editor/core'
import { blockSelectionPlugin } from '.'
import { selectBlockAt, extendSelectionTo } from './blockSelection'
import { downloadSelected, duplicateSelected, moveSelected, selectedBlocksJson } from './selectionActions'

const make = (content: string) =>
  createTestEditor({
    plugins: [{ id: 'text', extensions: [StarterKit] }, blockSelectionPlugin],
    content,
  })

const posOf = (editor: ReturnType<typeof make>['editor'], text: string) => {
  let found = -1
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isTextblock && node.textContent === text) found = pos
  })
  return found
}

describe('selection bar actions', () => {
  it('downloads, duplicates and moves selected blocks', async () => {
    const { editor, destroy } = make('<p>A</p><p>B</p><p>C</p>')
    selectBlockAt(editor, posOf(editor, 'B'))
    extendSelectionTo(editor, posOf(editor, 'C'))
    expect(selectedBlocksJson(editor)?.map((n) => (n.content as { text?: string }[] | undefined)?.[0]?.text)).toEqual([
      'B',
      'C',
    ])
    const createObjectURL = vi.fn(() => 'blob:test')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    await expect(downloadSelected(editor, 'markdown')).resolves.toBe(true)
    expect(createObjectURL).toHaveBeenCalled()
    click.mockRestore()
    expect(duplicateSelected(editor)).toBe(true)
    expect(editor.getText({ blockSeparator: ',' })).toContain('A,B,C,B,C')
    selectBlockAt(editor, posOf(editor, 'A'))
    expect(moveSelected(editor, 1)).toBe(true)
    expect(editor.getText({ blockSeparator: ',' }).startsWith('B')).toBe(true)
    expect(blockSelectionPluginKey.getState(editor.state)).toBeTruthy()
    destroy()
  })
})
