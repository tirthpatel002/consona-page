import type { AnyExtension, Editor } from '@tiptap/core'
import type { IconName } from '../ui/Icon'
import type { ReactNode } from 'react'
import type { EditorUiStores } from '../registry/createExtensions'
import type { BlockAction, BlockModule } from '../block/types'
import type { TurnIntoDefinition } from '../block/turnInto'
import type { SlashItem } from '../slash/types'
import type { BlockToolbarDefinition } from '../toolbar/blockToolbarDefinition'
import type { ToolbarItem } from '../toolbar/types'

/** Optional count on the toolbar panel toggle (e.g. open comments). */
export interface PanelBadge {
  readonly getCount: (editor: Editor) => number
  readonly subscribe: (editor: Editor, listener: () => void) => () => void
}

/** A side panel that can be toggled from the toolbar (e.g. a JSON inspector). */
export interface PanelDefinition {
  readonly id: string
  readonly label: string
  /** Toolbar toggle icon; falls back to the text label when omitted. */
  readonly icon?: IconName
  readonly render: (editor: Editor, ui: EditorUiStores) => ReactNode
  readonly badge?: PanelBadge
}

/**
 * Floating UI rendered over the editor surface (bubble/contextual toolbars, popovers).
 * `render` is called on every PageEditor render; components subscribe to the editor themselves
 * (e.g. `useEditorState`) and may portal into their own node views.
 */
export interface OverlayDefinition {
  readonly id: string
  readonly render: (editor: Editor, ui: EditorUiStores) => ReactNode
}

/**
 * The unit of extension. Every contribution is optional; the registry composes them.
 * Blocks automatically get "insert" slash items and toolbar entries.
 */
export interface PagePlugin {
  readonly id: string
  readonly extensions?: readonly AnyExtension[]
  readonly blocks?: readonly BlockModule[]
  readonly slashItems?: readonly SlashItem[]
  readonly toolbarItems?: readonly ToolbarItem[]
  readonly blockActions?: readonly BlockAction[]
  /** "Turn into" conversions this plugin registers for its block types (D2). */
  readonly turnInto?: readonly TurnIntoDefinition[]
  readonly panels?: readonly PanelDefinition[]
  readonly overlays?: readonly OverlayDefinition[]
  /** Contextual toolbars attached to one kind of block (e.g. the table's Add / Remove / Sort). */
  readonly blockToolbars?: readonly BlockToolbarDefinition[]
}
