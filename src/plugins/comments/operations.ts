import type { Editor } from '@tiptap/core'
import { defineOperation } from '../../editor/core'
import { getCommentStore, type CommentStore } from './store'
import type { CommentThread } from './types'

/** Anchors a new comment thread to the current selection (F1). One undo step with the mark. */
export const anchorCommentThread = defineOperation('anchorCommentThread', (chain, threadId: string) =>
  chain.setMark('comment', { threadId }),
)

/** Removes a thread's anchor wherever the marked range sits (thread or last message deleted). */
export const removeCommentAnchor = defineOperation('removeCommentAnchor', (chain, threadId: string) =>
  chain.command(({ state, tr }) => {
    const type = state.schema.marks.comment
    let found = false
    state.doc.descendants((node, pos) => {
      if (node.marks.some((mark) => mark.type === type && mark.attrs.threadId === threadId)) {
        tr.removeMark(pos, pos + node.nodeSize, type)
        found = true
      }
      return true
    })
    return found
  }),
)

/** Anchors a block-level thread: sets the block's commentThread attribute (one undo step). */
export const anchorBlockCommentThread = defineOperation(
  'anchorBlockCommentThread',
  (chain, pos: number, threadId: string) =>
    chain.command(({ state, tr }) => {
      const node = state.doc.nodeAt(pos)
      if (!node || node.type.spec.attrs?.commentThread === undefined) return false
      tr.setNodeAttribute(pos, 'commentThread', threadId)
      return true
    }),
)

/** Removes a block-level anchor (thread or its last message deleted). */
export const removeBlockCommentAnchor = defineOperation('removeBlockCommentAnchor', (chain, threadId: string) =>
  chain.command(({ state, tr }) => {
    let found = false
    state.doc.descendants((node, pos) => {
      if (node.attrs.commentThread === threadId) {
        tr.setNodeAttribute(pos, 'commentThread', null)
        found = true
        return false
      }
      return true
    })
    return found
  }),
)

/**
 * Deletes a thread for real: the anchor leaves the document as one undoable step and the thread
 * is tombstoned in the store. Undo restores anchor + thread with its messages; redo deletes both
 * again. Deleting the thread of an anchor that is still in the document requires an editable
 * page; orphaned threads (anchor already gone) delete without touching the document.
 */
export const deleteThreadAndAnchor = (
  editor: Editor,
  thread: CommentThread,
  store: CommentStore = getCommentStore(editor),
): void => {
  const anchored = !thread.orphaned
  if (anchored && !editor.isEditable) return
  store.deleteThread(thread.id)
  if (!anchored) return
  const op = thread.anchorKind === 'block' ? removeBlockCommentAnchor : removeCommentAnchor
  op.run(editor, thread.id)
}
