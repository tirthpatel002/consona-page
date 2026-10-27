import type { Editor } from '@tiptap/core'
import type { ReactNode } from 'react'
import type { IconName } from '../ui/Icon'

export interface ToolbarItemContext {
  readonly editor: Editor
  /** Closes the popover this content is shown in. */
  readonly close: () => void
}

/**
 * One toolbar button. Plugins declare these; the core places them.
 * - `placement: 'main'` (default) is the top toolbar, `'bubble'` the toolbar over selected text.
 * - `run` makes it a plain button; `popover` makes it open a floating panel (colours, links...).
 * - `shortcut` (e.g. 'Mod-Shift-x') is bound to `run` by the core.
 */
export interface ToolbarItem {
  readonly id: string
  /** Items with the same group are rendered together. */
  readonly group: string
  readonly label: string
  readonly title?: string
  /** Static icon, or one resolved from the editor state (e.g. lock/unlock). */
  readonly icon?: IconName | ((editor: Editor) => IconName)
  /** 'main' (default): top toolbar. 'bubble': over selected text. 'both'. */
  readonly placement?: 'main' | 'bubble' | 'both'
  readonly shortcut?: string
  readonly isActive?: (editor: Editor) => boolean
  /** Default: the editor must be editable. Pass `() => true` for read-only-safe actions (export, lock). */
  readonly isEnabled?: (editor: Editor) => boolean
  readonly run?: (editor: Editor) => void
  readonly popover?: (context: ToolbarItemContext) => ReactNode
  /** Nested menu entries; opens in a space-aware flyout on click or hover (instead of inline popover content). */
  readonly flyout?: (context: ToolbarItemContext) => readonly {
    readonly id: string
    readonly label: string
    readonly onSelect: () => void
  }[]
}
