import { Extension, type AnyExtension } from '@tiptap/core'
import { createBlockNode } from '../block/blockNode'
import { pageLockExtension } from '../lock'
import { createSlashExtension } from '../slash/slashExtension'
import type { PanelStore } from '../plugin/panelStore'
import type { SlashStore } from '../slash/slashStore'
import type { PageRegistry } from './composePlugins'

export interface EditorUiStores {
  readonly slash: SlashStore
  readonly panels: PanelStore
}

/** Plugin extensions + the core block node + the slash menu. */
export function createExtensions(registry: PageRegistry, ui: EditorUiStores): AnyExtension[] {
  return [
    ...registry.extensions,
    createBlockNode({ blocks: registry.blocks }),
    pageLockExtension,
    createShortcutsExtension(registry),
    createSlashExtension({ items: registry.slashItems, store: ui.slash }),
  ]
}

/** Binds every ToolbarItem `shortcut` to its `run`. */
function createShortcutsExtension(registry: PageRegistry): AnyExtension {
  return Extension.create({
    name: 'pageShortcuts',
    addKeyboardShortcuts() {
      const bindings: Record<string, () => boolean> = {}
      for (const item of registry.toolbarItems) {
        const { shortcut, run } = item
        if (!shortcut || !run) continue
        bindings[shortcut] = () => {
          run(this.editor)
          return true
        }
      }
      return bindings
    },
  })
}
