import type { Editor } from '@tiptap/core'
import type { CommentStore } from './store'

/**
 * Marks anchors whose thread no longer exists (deleted before it could persist, or brought
 * back by a version restore) as dangling in the DOM: they keep their position but render
 * muted and inert instead of looking like an actionable live comment. No document mutation -
 * this is presentation only, so it never touches the undo stack.
 */
export const markDanglingAnchors = (editor: Editor, store: CommentStore): void => {
  for (const el of editor.view.dom.querySelectorAll('[data-comment-thread]')) {
    const id = el.getAttribute('data-comment-thread')
    const dangling = Boolean(id) && !store.get(id as string)
    el.classList.toggle('page-comment--dangling', dangling)
    if (dangling) el.setAttribute('title', 'This comment was deleted')
    else el.removeAttribute('title')
  }
}
