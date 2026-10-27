import { Extension } from '@tiptap/core'

/** Top-level block types that can carry a block-level comment thread (F1). */
export const COMMENTABLE_BLOCKS = [
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'bulletList',
  'orderedList',
  'taskList',
  'table',
  'horizontalRule',
  'embedBlock',
]

/**
 * The block-level comment anchor: a `commentThread` attribute on any commentable top-level
 * block. Like the inline mark, the attribute travels with its block through edits, undo/redo
 * and version restores, and deleting the block orphans (never drops) the thread.
 */
export const blockCommentAnchor = Extension.create({
  name: 'blockCommentAnchor',

  addGlobalAttributes() {
    return [
      {
        types: COMMENTABLE_BLOCKS,
        attributes: {
          commentThread: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('data-comment-thread'),
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes.commentThread ? { 'data-comment-thread': String(attributes.commentThread) } : {},
          },
        },
      },
    ]
  },
})
