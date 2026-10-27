import type { Editor } from '@tiptap/core'
import { useState } from 'react'
import { anchorBlockCommentThread, anchorCommentThread } from './operations'
import { getCommentStore } from './store'
import { commentsUi } from './uiStore'

/**
 * Popover content for adding a comment: bubble action (text anchor) or block menu (block anchor,
 * the only option for atom blocks without selectable text).
 */
export function CommentComposer({
  editor,
  close,
  blockPos,
}: {
  readonly editor: Editor
  readonly close: () => void
  /** Block position when commenting on a whole block; omitted for text selection comments. */
  readonly blockPos?: number
}) {
  const [text, setText] = useState('')
  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    const thread = getCommentStore(editor).createThread(trimmed, blockPos === undefined ? 'text' : 'block')
    const anchored =
      blockPos === undefined
        ? anchorCommentThread.run(editor, thread.id)
        : anchorBlockCommentThread.run(editor, blockPos, thread.id)
    if (!anchored) getCommentStore(editor).deleteThread(thread.id)
    else commentsUi.selectAndOpen(thread.id)
    close()
  }
  return (
    <div className="page-comment-composer">
      <textarea
        aria-label="Comment"
        placeholder="Add a comment…"
        value={text}
        autoFocus
        rows={3}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit()
          if (event.key === 'Escape') close()
        }}
      />
      <div className="page-comment-composer__footer">
        <button type="button" className="page-comment-composer__submit" disabled={!text.trim()} onClick={submit}>
          Comment
        </button>
      </div>
    </div>
  )
}
