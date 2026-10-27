import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import type { PagePlugin } from '../../editor/core'
import { codeBlockExtension } from './codeBlock'
import { textSlashItems } from './slashItems'
import { textToolbarItems } from './toolbarItems'
import { turnIntoConversions } from './turnInto'

export interface TextPluginOptions {
  readonly placeholder?: string
}

/** Rich text (bullet/numbered lists come from the lists plugin, which must be composed too): paragraphs, headings, lists, marks, markdown input rules (StarterKit), placeholder, "Turn into". */
export function textPlugin({ placeholder = "Type '/' for commands…" }: TextPluginOptions = {}): PagePlugin {
  return {
    id: 'text',
    extensions: [
      StarterKit.configure({ link: { openOnClick: false }, bulletList: false, orderedList: false, codeBlock: false }),
      codeBlockExtension,
      Placeholder.configure({ placeholder }),
    ],
    toolbarItems: textToolbarItems,
    slashItems: textSlashItems,
    turnInto: turnIntoConversions,
  }
}
