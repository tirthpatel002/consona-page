import { Extension } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import * as z from 'zod/mini'
import { defineBlock } from '../block/defineBlock'
import type { PagePlugin } from '../plugin/types'
import { BLOCK_SLASH_GROUP, composePlugins, PluginConflictError } from './composePlugins'

const makeBlock = (type: string) =>
  defineBlock({ type, title: type.toUpperCase(), schema: z.object({}), template: () => ({}), render: () => null })

const noop = () => undefined

describe('composePlugins', () => {
  it('merges contributions in plugin order and generates block slash items', () => {
    const plugins: PagePlugin[] = [
      {
        id: 'text',
        extensions: [Extension.create({ name: 'a' })],
        slashItems: [{ id: 'h1', title: 'Heading', group: 'Text', run: noop }],
        toolbarItems: [{ id: 'bold', group: 'marks', label: 'B', run: noop }],
      },
      { id: 'blocks', blocks: [makeBlock('chart'), makeBlock('table')] },
      { id: 'actions', blockActions: [{ id: 'delete', label: 'Delete', run: noop }] },
      { id: 'json', panels: [{ id: 'json', label: 'JSON', render: () => null }] },
      { id: 'float', overlays: [{ id: 'bubble', render: () => null }] },
    ]
    const registry = composePlugins(plugins)

    expect(registry.extensions.map((e) => e.name)).toEqual(['a'])
    expect([...registry.blocks.keys()]).toEqual(['chart', 'table'])
    expect(registry.slashItems.map((s) => s.id)).toEqual(['h1', 'insert-block:chart', 'insert-block:table'])
    expect(registry.slashItems[1]?.group).toBe(BLOCK_SLASH_GROUP)
    expect(registry.toolbarItems).toHaveLength(1)
    expect(registry.blockActions).toHaveLength(1)
    expect(registry.panels).toHaveLength(1)
    expect(registry.overlays.map((o) => o.id)).toEqual(['bubble'])
  })

  it('handles an empty plugin list', () => {
    const registry = composePlugins([])
    expect(registry.blocks.size).toBe(0)
    expect(registry.slashItems).toEqual([])
  })

  it.each<[string, PagePlugin[], RegExp]>([
    ['plugin ids', [{ id: 'x' }, { id: 'x' }], /plugin id "x"/],
    [
      'block types',
      [
        { id: 'a', blocks: [makeBlock('t')] },
        { id: 'b', blocks: [makeBlock('t')] },
      ],
      /block type "t" \(from "a" and "b"\)/,
    ],
    [
      'extension names',
      [
        { id: 'a', extensions: [Extension.create({ name: 'dup' })] },
        { id: 'b', extensions: [Extension.create({ name: 'dup' })] },
      ],
      /extension name "dup"/,
    ],
    [
      'slash items',
      [
        { id: 'a', slashItems: [{ id: 's', title: 'S', group: 'G', run: noop }] },
        { id: 'b', slashItems: [{ id: 's', title: 'S', group: 'G', run: noop }] },
      ],
      /slash item "s"/,
    ],
    [
      'generated vs custom slash ids',
      [
        {
          id: 'a',
          blocks: [makeBlock('t')],
          slashItems: [{ id: 'insert-block:t', title: 'T', group: 'G', run: noop }],
        },
      ],
      /slash item "insert-block:t"/,
    ],
    [
      'overlays',
      [
        { id: 'a', overlays: [{ id: 'o', render: () => null }] },
        { id: 'b', overlays: [{ id: 'o', render: () => null }] },
      ],
      /overlay "o"/,
    ],
  ])('rejects duplicate %s', (_label, plugins, message) => {
    expect(() => composePlugins(plugins)).toThrow(PluginConflictError)
    expect(() => composePlugins(plugins)).toThrow(message)
  })
})
