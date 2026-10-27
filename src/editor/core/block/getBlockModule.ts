import type { Editor } from '@tiptap/core'
import type { BlockModule } from './types'

/** Looks up a registered block module from a live editor (e.g. to validate before writing). */
export function getBlockModule(editor: Editor, blockType: string): BlockModule | undefined {
  return editor.storage.embedBlock.blocks.get(blockType)
}
