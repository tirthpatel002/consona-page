import type { Editor, JSONContent } from '@tiptap/core'

/** App hooks for selection-bar actions that need the page tree or AI chrome. */
export interface SelectionHost {
  /** Open a destination picker and append these blocks to another page (then remove them here). */
  readonly moveToPage?: (editor: Editor, blocks: readonly JSONContent[]) => void | Promise<void>
  /** Create a new page whose body is these blocks (and remove them from the current page). */
  readonly createPageWith?: (editor: Editor, blocks: readonly JSONContent[]) => void | Promise<void>
  /** Open the AI actions modal for the current block selection. */
  readonly openAiActions?: (editor: Editor) => void | Promise<void>
}

let host: SelectionHost = {}

export const setSelectionHost = (next: SelectionHost) => {
  host = next
}

export const getSelectionHost = () => host
