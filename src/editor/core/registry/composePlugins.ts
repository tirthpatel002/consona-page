import type { AnyExtension } from '@tiptap/core'
import { insertBlock } from '../operations/operations'
import type { BlockAction, BlockModule } from '../block/types'
import { turnIntoAction } from '../block/turnInto'
import type { OverlayDefinition, PagePlugin, PanelDefinition } from '../plugin/types'
import type { BlockToolbarDefinition } from '../toolbar/blockToolbarDefinition'
import type { SlashItem } from '../slash/types'
import type { ToolbarItem } from '../toolbar/types'

export const BLOCK_SLASH_GROUP = 'Blocks'

export interface PageRegistry {
  readonly plugins: readonly PagePlugin[]
  readonly extensions: readonly AnyExtension[]
  readonly blocks: ReadonlyMap<string, BlockModule>
  readonly slashItems: readonly SlashItem[]
  readonly toolbarItems: readonly ToolbarItem[]
  readonly blockActions: readonly BlockAction[]
  readonly panels: readonly PanelDefinition[]
  readonly overlays: readonly OverlayDefinition[]
  readonly blockToolbars: readonly BlockToolbarDefinition[]
}

export class PluginConflictError extends Error {
  override name = 'PluginConflictError'
}

function assertUnique(kind: string, entries: readonly { key: string; owner: string }[]): void {
  const seen = new Map<string, string>()
  for (const { key, owner } of entries) {
    const previous = seen.get(key)
    if (previous !== undefined) {
      throw new PluginConflictError(`Duplicate ${kind} "${key}" (from "${previous}" and "${owner}")`)
    }
    seen.set(key, owner)
  }
}

export function blockSlashItem(block: BlockModule): SlashItem {
  return {
    id: `insert-block:${block.type}`,
    title: block.title,
    group: BLOCK_SLASH_GROUP,
    description: block.description,
    keywords: block.keywords,
    run: (editor) => {
      insertBlock.run(editor, block.type)
    },
  }
}

/** Composes plugins into one registry. Pure; throws PluginConflictError on any id clash. */
export function composePlugins(plugins: readonly PagePlugin[]): PageRegistry {
  const collect = <T>(pick: (plugin: PagePlugin) => readonly T[] | undefined) =>
    plugins.flatMap((plugin) => (pick(plugin) ?? []).map((value) => ({ value, owner: plugin.id })))

  const extensions = collect((p) => p.extensions)
  const blocks = collect((p) => p.blocks)
  const toolbarItems = collect((p) => p.toolbarItems)
  const blockActions = collect((p) => p.blockActions)
  const turnInto = collect((p) => p.turnInto)
  const panels = collect((p) => p.panels)
  const overlays = collect((p) => p.overlays)
  const blockToolbars = collect((p) => p.blockToolbars)
  const slashItems = [
    ...collect((p) => p.slashItems),
    ...blocks.map(({ value, owner }) => ({ value: blockSlashItem(value), owner })),
  ]

  assertUnique(
    'plugin id',
    plugins.map((p) => ({ key: p.id, owner: p.id })),
  )
  assertUnique(
    'extension name',
    extensions.map(({ value, owner }) => ({ key: value.name, owner })),
  )
  assertUnique(
    'block type',
    blocks.map(({ value, owner }) => ({ key: value.type, owner })),
  )
  assertUnique(
    'slash item',
    slashItems.map(({ value, owner }) => ({ key: value.id, owner })),
  )
  assertUnique(
    'toolbar item',
    toolbarItems.map(({ value, owner }) => ({ key: value.id, owner })),
  )
  assertUnique(
    'block action',
    blockActions.map(({ value, owner }) => ({ key: value.id, owner })),
  )
  assertUnique(
    'turn into',
    turnInto.map(({ value, owner }) => ({ key: value.id, owner })),
  )
  assertUnique(
    'panel',
    panels.map(({ value, owner }) => ({ key: value.id, owner })),
  )
  assertUnique(
    'overlay',
    overlays.map(({ value, owner }) => ({ key: value.id, owner })),
  )

  assertUnique(
    'block toolbar',
    blockToolbars.map(({ value, owner }) => ({ key: value.id, owner })),
  )

  const values = <T>(entries: readonly { value: T }[]) => entries.map((entry) => entry.value)
  return {
    plugins,
    extensions: values(extensions),
    blocks: new Map(blocks.map(({ value }) => [value.type, value])),
    slashItems: values(slashItems),
    toolbarItems: values(toolbarItems),
    // Registered conversions open the menu: the shared "Turn into" section stays first.
    blockActions: [...turnInto.map(({ value }) => turnIntoAction(value)), ...values(blockActions)],
    panels: values(panels),
    overlays: values(overlays),
    blockToolbars: values(blockToolbars),
  }
}
