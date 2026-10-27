import { redo, undo } from '../operations/operations'
import type { ToolbarItem } from './types'

/**
 * Core toolbar items every page gets, ahead of the plugins' items: undo/redo (B3).
 * The model-level read-only guarantee comes from the lock extension; these simply disable while locked
 * (a locked editor is not editable, and undo is a mutation).
 */
export const historyToolbarItems: readonly ToolbarItem[] = [
  {
    id: 'core:undo',
    group: 'history',
    label: 'Undo',
    title: 'Undo (⌘Z)',
    icon: 'undo',
    isEnabled: (editor) => editor.isEditable && editor.can().undo(),
    run: (editor) => void undo.run(editor),
  },
  {
    id: 'core:redo',
    group: 'history',
    label: 'Redo',
    title: 'Redo (⌘⇧Z)',
    icon: 'redo',
    isEnabled: (editor) => editor.isEditable && editor.can().redo(),
    run: (editor) => void redo.run(editor),
  },
]

/** Page-level controls after the plugins' items: the read-only page lock (B4). */
export const pageToolbarItems: readonly ToolbarItem[] = [
  {
    id: 'core:lock',
    group: 'page',
    label: 'Lock',
    title: 'Lock page (read-only; links still work)',
    icon: (editor) => (editor.isEditable ? 'lock' : 'unlock'),
    isActive: (editor) => !editor.isEditable,
    isEnabled: () => true,
    // Editable now -> lock it; locked now -> unlock it.
    run: (editor) => editor.commands.setPageLocked(editor.isEditable),
  },
]
