import type { Editor } from '@tiptap/core'
import type { MediaKind } from './sources'

/** Which media panel is open. Insert panels belong to the caret; the others to the block at `pos`. */
export type MediaPanel =
  | { readonly type: 'insert'; readonly kind: MediaKind; readonly tab: 'upload' | 'link'; readonly at?: number }
  | { readonly type: 'replace'; readonly pos: number; readonly kind: MediaKind; readonly tab: 'upload' | 'link' }
  | { readonly type: 'alt'; readonly pos: number }
  | { readonly type: 'link'; readonly pos: number }
  | { readonly type: 'crop'; readonly pos: number }
  | { readonly type: 'fullscreen'; readonly pos: number }

interface State {
  readonly editor: Editor
  readonly panel: MediaPanel
}

let state: State | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

export const panelStore = {
  get: (): State | null => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

/** Opens a panel (replacing any open one). Does nothing for editing panels on a locked page. */
export function openPanel(editor: Editor, panel: MediaPanel): void {
  if (!editor.isEditable && panel.type !== 'fullscreen') return
  state = { editor, panel }
  editor.once('destroy', () => {
    if (state?.editor === editor) closePanel()
  })
  emit()
}

export function closePanel(): void {
  if (state === null) return
  state = null
  emit()
}
