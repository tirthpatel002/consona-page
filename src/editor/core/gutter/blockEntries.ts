import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'

/** Name of the optional editor-storage entry through which a plugin declares layout nodes that hold nested blocks. */
export const NESTED_BLOCKS_STORAGE = 'pageNestedBlockContainers'

export interface NestedBlocksStorage {
  /** Node type names (e.g. a column list and its column) whose descendants are addressable blocks. */
  readonly containers: readonly string[]
  /** Containers that are also blocks in their own right when nested (e.g. a list item that holds more items). */
  readonly addressable?: readonly string[]
  /** Containers whose non-container children are their content, not blocks (a list item's paragraph). */
  readonly owners?: readonly string[]
}

export interface NestedConfig {
  readonly containers: readonly string[]
  readonly addressable: readonly string[]
  readonly owners: readonly string[]
}

export interface BlockEntry {
  readonly pos: number
  readonly node: PMNode
  readonly dom: HTMLElement
  /** Number of ancestors below the document: 0 for a top-level block, more inside containers. */
  readonly depth: number
}

/** Merges every plugin's nested-block declaration (editor-storage entries named like NESTED_BLOCKS_STORAGE). */
export function nestedConfig(editorStorage: unknown): NestedConfig {
  const containers: string[] = []
  const addressable: string[] = []
  const owners: string[] = []
  for (const [name, value] of Object.entries(
    (editorStorage ?? {}) as Record<string, NestedBlocksStorage | undefined>,
  )) {
    if (!name.startsWith(NESTED_BLOCKS_STORAGE) || !value) continue
    containers.push(...value.containers)
    addressable.push(...(value.addressable ?? []))
    owners.push(...(value.owners ?? []))
  }
  return { containers, addressable, owners }
}

export const nestedContainers = (editorStorage: unknown): readonly string[] => nestedConfig(editorStorage).containers

/**
 * Every block the gutter can address: each top-level block, plus the blocks inside declared containers
 * (a child is a block unless it is itself a container, which is only structure).
 */
export function blockEntries(
  view: EditorView,
  containers: readonly string[],
  options: { readonly addressable?: readonly string[]; readonly owners?: readonly string[] } = {},
): BlockEntry[] {
  const entries: BlockEntry[] = []
  const visit = (parent: PMNode, parentStart: number, depth: number) => {
    const owned = options.owners?.includes(parent.type.name) ?? false
    parent.forEach((child, offset) => {
      const pos = parentStart + offset
      const isContainer = containers.includes(child.type.name)
      if (owned && !isContainer) return
      if (depth === 0 || !isContainer || options.addressable?.includes(child.type.name)) {
        const dom = view.nodeDOM(pos)
        if (dom instanceof HTMLElement) entries.push({ pos, node: child, dom, depth })
      }
      if (isContainer) visit(child, pos + 1, depth + 1)
    })
  }
  visit(view.state.doc, 0, 0)
  return entries
}
