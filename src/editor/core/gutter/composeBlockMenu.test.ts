import { Schema } from '@tiptap/pm/model'
import { describe, expect, it, vi } from 'vitest'
import type { BlockAction, BlockTarget } from '../block/types'
import { composeBlockMenu } from './composeBlockMenu'

const schema = new Schema({ nodes: { doc: { content: 'block+' }, paragraph: { group: 'block' }, text: {} } })
const target = (over: Partial<BlockTarget> = {}): BlockTarget => ({
  pos: 0,
  node: schema.node('paragraph'),
  nodeType: 'paragraph',
  blockType: 'paragraph',
  isEmbed: false,
  props: {},
  ...over,
})
const act = (id: string, extra: Partial<BlockAction> = {}): BlockAction => ({
  id,
  label: id,
  run: () => undefined,
  ...extra,
})

describe('composeBlockMenu', () => {
  const actions = [
    act('turn:h1', { section: 'Turn into', appliesTo: (t) => t.nodeType === 'paragraph' }),
    act('duplicate'),
    act('edit-props', { appliesTo: (t) => t.isEmbed }),
    act('turn:text', { section: 'Turn into', appliesTo: (t) => t.nodeType === 'paragraph' }),
    act('delete', { danger: true }),
  ]

  it('groups applicable actions by section in first-seen order (text block)', () => {
    const sections = composeBlockMenu({
      target: target(),
      propsActions: [],
      blockActions: actions,
      applyProps: vi.fn(),
      runAction: vi.fn(),
    })
    expect(sections.map((s) => [s.label, s.items.map((i) => i.id)])).toEqual([
      [undefined, ['turn-into']],
      [undefined, ['duplicate', 'delete']],
    ])
    expect(sections[0]?.items[0]?.submenu?.map((i) => i.id)).toEqual(['turn:h1', 'turn:text'])
    expect(sections[1]?.items[1]?.danger).toBe(true)
  })

  it('puts an embed’s own props actions first, labelled with the block title, and wires callbacks', () => {
    const applyProps = vi.fn()
    const runAction = vi.fn()
    const propsAction = { id: 'stack', label: 'Stack bars', apply: () => ({}) }
    const sections = composeBlockMenu({
      target: target({ nodeType: 'embedBlock', blockType: 'bar-chart', isEmbed: true }),
      blockTitle: 'Bar chart',
      propsActions: [propsAction],
      blockActions: actions,
      applyProps,
      runAction,
    })
    expect(sections.map((s) => [s.label, s.items.map((i) => i.id)])).toEqual([
      ['Bar chart', ['stack']],
      [undefined, ['duplicate', 'edit-props', 'delete']],
    ])
    sections[0]?.items[0]?.select()
    sections[1]?.items[1]?.select()
    expect(applyProps).toHaveBeenCalledWith(propsAction)
    expect(runAction).toHaveBeenCalledWith(actions[2])
  })

  it('keeps danger items last in their group, whatever the registration order', () => {
    const sections = composeBlockMenu({
      target: target(),
      propsActions: [],
      blockActions: [act('delete', { danger: true }), act('duplicate'), act('edit')],
      applyProps: vi.fn(),
      runAction: vi.fn(),
    })
    expect(sections[0]?.items.map((i) => i.id)).toEqual(['duplicate', 'edit', 'delete'])
  })

  it('nests several style variants under Styles and keeps other actions beside it', () => {
    const applyProps = vi.fn()
    const info = { id: 'style-info', label: '✓ Style: info', apply: () => ({}), style: true as const }
    const sections = composeBlockMenu({
      target: target(),
      propsActions: [info, { id: 'style-warning', label: 'Style: warning', apply: () => ({}), style: true }],
      blockActions: [
        act('marker-decimal', { style: true, label: '1, 2, 3' }),
        act('marker-alpha', { style: true, label: 'a, b, c' }),
        act('duplicate'),
        act('delete', { danger: true }),
      ],
      applyProps,
      runAction: vi.fn(),
    })
    expect(sections.map((s) => [s.label, s.items.map((i) => i.id)])).toEqual([
      [undefined, ['styles']],
      [undefined, ['duplicate', 'delete']],
    ])
    expect(sections[0]?.items[0]?.submenu?.map((i) => i.label)).toEqual([
      '✓ Style: info',
      'Style: warning',
      '1, 2, 3',
      'a, b, c',
    ])
    sections[0]?.items[0]?.submenu?.[0]?.select()
    expect(applyProps).toHaveBeenCalledWith(info)
  })

  it('leaves a single style variant as its own row', () => {
    const sections = composeBlockMenu({
      target: target(),
      propsActions: [],
      blockActions: [act('columns:as-grid', { style: true, label: 'Show as grid' }), act('duplicate')],
      applyProps: vi.fn(),
      runAction: vi.fn(),
    })
    expect(sections.map((s) => s.items.map((i) => i.id))).toEqual([['columns:as-grid'], ['duplicate']])
    expect(sections[0]?.items[0]?.submenu).toBeUndefined()
  })

  it('returns no sections when nothing applies', () => {
    expect(
      composeBlockMenu({
        target: target(),
        propsActions: [],
        blockActions: [act('x', { appliesTo: () => false })],
        applyProps: vi.fn(),
        runAction: vi.fn(),
      }),
    ).toEqual([])
  })
})
