/** F1 comments (local-first, Notion-style). Single local author: "You". No notifications,
 *  mentions or presence - those need a backend this app does not have. */
export const COMMENT_AUTHOR = 'You'

export interface CommentMessage {
  readonly id: string
  readonly author: string
  readonly text: string
  readonly createdAt: number
  readonly editedAt?: number
  /** Set when this message is a reply to another message in the same thread. */
  readonly parentId?: string
}

export interface CommentThread {
  readonly id: string
  /**
   * Text-anchored threads live as a `comment` mark with this thread id in the document, so the
   * anchor maps through edits/undo/redo/version-restore automatically (marks travel with the
   * content). `orphaned` is set when the marked range left the document (text deleted); the
   * thread is kept for the user to resolve or delete - never silently dropped.
   */
  readonly orphaned?: boolean
  /** 'text': comment mark on a range. 'block': commentThread attribute on the block node. */
  readonly anchorKind: 'text' | 'block'
  readonly messages: readonly CommentMessage[]
  readonly status: 'open' | 'resolved'
  readonly createdAt: number
}

/** Storage format for the persisted thread list. */
export const COMMENTS_FORMAT = 1
