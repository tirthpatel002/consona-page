import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import type { BlockTarget } from '../../editor/core'
import { turnIntoActions } from './turnInto'

const schema = getSchema([StarterKit])
const nodeOf = (nodeType: string, attrs?: Record<string, unknown>) => {
  const node = schema.nodes[nodeType]?.createAndFill(attrs)
  if (!node) throw new Error(`cannot create ${nodeType}`)
  return node
}
const target = (nodeType: string, attrs?: Record<string, unknown>): BlockTarget => ({
  pos: 0,
  node: nodeOf(nodeType, attrs),
  nodeType,
  blockType: nodeType,
  isEmbed: false,
  props: {},
})
const offered = (t: BlockTarget) => turnIntoActions.filter((a) => a.appliesTo?.(t) ?? true).map((a) => a.label)

describe('turnIntoActions', () => {
  it('offers every other text type for a paragraph', () => {
    expect(offered(target('paragraph'))).toEqual([
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Bulleted list',
      'Numbered list',
      'Quote',
      'Code',
    ])
  })
  it('omits the current heading level', () => {
    expect(offered(target('heading', { level: 2 }))).toEqual([
      'Text',
      'Heading 1',
      'Heading 3',
      'Bulleted list',
      'Numbered list',
      'Quote',
      'Code',
    ])
  })
  it('offers the other text types for a list, a code block, and an embed', () => {
    expect(offered(target('bulletList'))).toEqual([
      'Text',
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Numbered list',
      'Quote',
      'Code',
    ])
    expect(offered(target('codeBlock'))).toEqual([
      'Text',
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Bulleted list',
      'Numbered list',
      'Quote',
    ])
    expect(offered({ ...target('paragraph'), nodeType: 'embedBlock', blockType: 'equation', isEmbed: true })).toEqual([
      'Text',
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Bulleted list',
      'Numbered list',
      'Quote',
      'Code',
    ])
  })
  it('does not apply to a divider', () => {
    expect(offered(target('horizontalRule'))).toEqual([])
  })
  it('groups under "Turn into"', () => {
    expect(new Set(turnIntoActions.map((a) => a.section))).toEqual(new Set(['Turn into']))
  })
})
