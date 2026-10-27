import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { common, createLowlight } from 'lowlight'
import './codeBlock.css'

import { defineOperation } from '../../editor/core'
import { CodeBlockView } from './CodeBlockView'

/** Tab inside a code block: two spaces, one undo step. */
export const indentCode = defineOperation('indentCode', (chain) => chain.insertContent('  '))

const lowlight = createLowlight(common)

/** Fenced code block with syntax highlighting. Markdown: "```lang " at the start of a block. Tab indents inside it. */
export const codeBlockExtension = CodeBlockLowlight.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Tab: ({ editor }) => {
        if (!editor.isActive('codeBlock')) return false
        return indentCode.run(editor)
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView, { className: 'page-code-block' })
  },
}).configure({ lowlight, defaultLanguage: null })
