import type { Editor } from '@tiptap/core'
import { runTurnIntoOnSelection, turnIntoOptionsForSelection, turnIntoSelectionContext } from './turnIntoSelection'
import type { TurnIntoDefinition } from './turnInto'
import type { ToolbarItem } from '../toolbar/types'

const options = (editor: Editor, definitions: readonly TurnIntoDefinition[]) => {
  const context = turnIntoSelectionContext(editor.state)
  if (!context) return { context: null, options: [] as readonly TurnIntoDefinition[] }
  return { context, options: turnIntoOptionsForSelection(definitions, editor.state, context) }
}

/**
 * Bubble-toolbar "Turn into" entry for the selected text or block(s). Enabled only while a
 * non-empty selection has at least one compatible registered conversion.
 */
export const turnIntoBubbleItem = (definitions: readonly TurnIntoDefinition[]): ToolbarItem => ({
  id: 'core:turn-into',
  group: 'turn-into',
  label: 'Turn into',
  icon: 'turn-into',
  placement: 'bubble',
  isEnabled: (editor) => options(editor, definitions).options.length > 0,
  flyout: ({ editor, close }) => {
    const { context, options: available } = options(editor, definitions)
    return available.map((definition) => ({
      id: definition.id,
      label: definition.label,
      onSelect: () => {
        if (context) runTurnIntoOnSelection(editor, definition, context)
        close()
      },
    }))
  },
})
