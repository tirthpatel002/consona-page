import { Editor, type Content } from '@tiptap/core'
import { composePlugins, type PageRegistry } from '../registry/composePlugins'
import { createExtensions } from '../registry/createExtensions'
import { PanelStore } from '../plugin/panelStore'
import type { PagePlugin } from '../plugin/types'
import { SlashStore } from '../slash/slashStore'

export interface TestEditor {
  readonly editor: Editor
  readonly registry: PageRegistry
  readonly destroy: () => void
}

/**
 * Starts a real editor with only the chosen plugins, so a plugin's commands and operations
 * can be tested without a browser. Tests using it need `// @vitest-environment jsdom`.
 */
export function createTestEditor({
  plugins,
  content = '',
}: {
  readonly plugins: readonly PagePlugin[]
  readonly content?: Content
}): TestEditor {
  const registry = composePlugins(plugins)
  const extensions = createExtensions(registry, { slash: new SlashStore(), panels: new PanelStore() })
  const editor = new Editor({ extensions, content })
  return { editor, registry, destroy: () => editor.destroy() }
}

/** Types text at the cursor one character at a time, so input rules (markdown shortcuts) fire like real typing. */
export function typeText(editor: Editor, text: string): void {
  for (const char of text) {
    const { from, to } = editor.state.selection
    const handled = editor.view.someProp('handleTextInput', (handler) =>
      handler(editor.view, from, to, char, () => editor.state.tr.insertText(char, from, to)),
    )
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(char, from, to))
  }
}
