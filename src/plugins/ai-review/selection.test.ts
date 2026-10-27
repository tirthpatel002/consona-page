// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- shared test fixture, not a runtime dependency
import { createTestEditor } from '../../editor/core/testing/createTestEditor'
import { textPlugin } from '../text'
import { formattingPlugin } from '../formatting'
import { blockSelectionPlugin } from '../block-selection'
import { extendSelectionTo, selectBlockAt } from '../block-selection/blockSelection'
import { inlineToMarkdown } from '../export/markdown'
import type { DocNode } from '../export/types'
import { captureAiTargets } from './selection'
import type { Node } from '@tiptap/pm/model'
const serialize = (node: Node) => inlineToMarkdown(node.toJSON().content as DocNode[])
describe('AI selection snapshots', () => {
  it('keeps unselected text and rich marks around a partial selection', () => {
    const { editor, destroy } = createTestEditor({
      plugins: [textPlugin(), formattingPlugin],
      content: '<p>before <strong>hello</strong> after</p>',
    })
    editor.commands.setTextSelection({ from: 8, to: 13 })
    const targets = captureAiTargets(editor, serialize)
    expect(targets).toHaveLength(1)
    expect(targets[0].selected).toBe('**hello**')
    expect(targets[0].uppercaseMarkdown).toBe('before **HELLO** after')
    destroy()
  })
  it('captures multi-block selection and whole-page scope', () => {
    const { editor, destroy } = createTestEditor({
      plugins: [textPlugin(), blockSelectionPlugin],
      content: '<p>one</p><p>two</p><p>three</p>',
    })
    selectBlockAt(editor, 0)
    extendSelectionTo(editor, 5)
    expect(captureAiTargets(editor, serialize).map((t) => t.selected)).toEqual(['one', 'two'])
    expect(captureAiTargets(editor, serialize, true)).toHaveLength(3)
    destroy()
  })
})
