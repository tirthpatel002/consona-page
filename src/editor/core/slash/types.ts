import type { Editor } from '@tiptap/core'

export interface SlashItem {
  readonly id: string
  readonly title: string
  readonly group: string
  readonly description?: string
  readonly keywords?: readonly string[]
  /** Runs after the "/query" text has been removed. */
  readonly run: (editor: Editor) => void
}
