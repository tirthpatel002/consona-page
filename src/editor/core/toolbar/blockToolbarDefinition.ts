import type { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'

/** One command in a block toolbar (a button or a menu entry). */
export interface BlockToolbarAction {
  readonly id: string
  readonly label: string
  readonly title: string
  readonly danger?: boolean
  /** Whether the command can run right now (disabled otherwise). */
  readonly can: (editor: Editor) => boolean
  readonly run: (editor: Editor) => void
  readonly isActive?: (editor: Editor) => boolean
}

/** A toolbar button that opens a vertical menu; sections are separated by a divider. */
export interface BlockToolbarMenu {
  readonly id: string
  readonly label: string
  readonly title: string
  readonly sections: readonly (readonly BlockToolbarAction[])[]
  /** Hide the menu button entirely when false (default: always shown). */
  readonly visible?: (editor: Editor) => boolean
}

export type BlockToolbarGroup =
  | { readonly kind: 'menus'; readonly menus: readonly BlockToolbarMenu[] }
  | { readonly kind: 'buttons'; readonly actions: readonly BlockToolbarAction[] }
  /** Shows only the first action that can run (e.g. Merge, else Split), or nothing. */
  | { readonly kind: 'first-enabled'; readonly actions: readonly BlockToolbarAction[] }

/** Ask the toolbar to open one of its menus, optionally at a viewport point. */
export interface MenuRequest {
  readonly menuId: string
  readonly at?: { readonly x: number; readonly y: number }
}

/**
 * A contextual toolbar a plugin attaches to one kind of block. The core finds the block, portals the
 * toolbar into the block's slot, tracks enabled/active state, and handles menus, focus and keyboard.
 */
export interface BlockToolbarDefinition {
  readonly id: string
  readonly label: string
  /** Document position of the block this toolbar belongs to, or null when it should be hidden. */
  readonly locate: (editor: Editor) => number | null
  /** The element inside the block's node view the toolbar is rendered into. */
  readonly slot: (blockDom: HTMLElement) => Element | null
  readonly groups: readonly BlockToolbarGroup[]
  /** Lets a transaction (e.g. a header chevron) open a menu. Return null to ignore. */
  readonly menuRequest?: (transaction: Transaction, editor: Editor) => MenuRequest | null
  /** Presses on matching elements never close an open menu (they toggle it themselves). */
  readonly isMenuOpener?: (target: Element) => boolean
}

export function allActions(definition: BlockToolbarDefinition): BlockToolbarAction[] {
  return definition.groups.flatMap((group) =>
    group.kind === 'menus' ? group.menus.flatMap((menu) => menu.sections.flat()) : [...group.actions],
  )
}
