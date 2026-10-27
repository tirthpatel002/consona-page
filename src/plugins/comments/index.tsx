import type { PagePlugin } from '../../editor/core'
import { blockCommentAnchor } from './blockAnchor'
import { commentMark } from './commentMark'
import { CommentComposer } from './CommentComposer'
import { CommentsAnchorSync } from './CommentsAnchorSync'
import { CommentsPanel } from './CommentsPanel'
import { getCommentStore } from './store'
import { commentsUi } from './uiStore'

const openCommentCount = (editor: Parameters<typeof getCommentStore>[0]): number =>
  getCommentStore(editor)
    .list()
    .filter((thread) => thread.status === 'open').length
import './comments.css'

/**
 * F1: Comments, local-first. Text-anchored threads via the comment mark, replies,
 * edit/delete own messages, resolve/reopen archive, orphan-safe anchors. Single local author;
 * no notifications, mentions or presence (no backend).
 */
export const commentsPlugin: PagePlugin = {
  id: 'comments',
  extensions: [commentMark, blockCommentAnchor],
  toolbarItems: [
    {
      id: 'comments:add',
      group: 'comment',
      label: 'Comment',
      title: 'Add comment',
      icon: 'comment',
      placement: 'bubble',
      popover: ({ editor, close }) => <CommentComposer editor={editor} close={close} />,
    },
  ],
  panels: [
    {
      id: 'comments',
      label: 'Comments',
      icon: 'comment',
      render: (editor, ui) => <CommentsPanel editor={editor} ui={ui} />,
      badge: {
        getCount: openCommentCount,
        subscribe: (editor, listener) => getCommentStore(editor).subscribe(listener),
      },
    },
  ],
  blockActions: [
    {
      id: 'comments:comment-block',
      label: 'Comment',
      section: 'Comments',
      run: ({ pos }) => commentsUi.openBlockComposer(pos),
    },
  ],
  overlays: [{ id: 'comments:sync', render: (editor, ui) => <CommentsAnchorSync editor={editor} ui={ui} /> }],
}
