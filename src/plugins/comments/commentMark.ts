import { Mark } from '@tiptap/core'

/**
 * The inline comment anchor (F1). Carries only the thread id; all content lives in the
 * CommentStore. Because the anchor is a mark, ProseMirror maps it through every edit, undo/redo
 * and version restore - the thread follows its text, and deleting the text removes the mark
 * (the store then flags the thread orphaned rather than dropping it).
 */
export const commentMark = Mark.create({
  name: 'comment',
  // A comment does not extend as you keep typing at its edge.
  inclusive: false,
  // Threads do not merge into each other.
  excludes: 'comment',
  spanning: true,

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment-thread'),
        renderHTML: (attributes) => ({ 'data-comment-thread': attributes.threadId as string }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-thread]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, class: 'page-comment' }, 0]
  },
})
