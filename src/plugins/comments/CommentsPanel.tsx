import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import type { MouseEvent } from 'react'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { getThreadAnchorPreview, navigateToThreadAnchor } from './anchorPreview'
import type { EditorUiStores } from '../../editor/core'
import {
  ancestorMessageIds,
  buildMessageForest,
  collectDescendantIds,
  countReplyTree,
  type CommentMessageNode,
} from './messageTree'
import { deleteThreadAndAnchor } from './operations'
import { getCommentStore } from './store'
import type { CommentMessage, CommentThread } from './types'
import { commentsUi } from './uiStore'

const formatTime = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

const stopBubble = (event: MouseEvent) => {
  event.stopPropagation()
}

function MessageEditor({
  initial,
  submit,
  cancel,
}: {
  readonly initial: string
  readonly submit: (text: string) => void
  readonly cancel: () => void
}) {
  const [text, setText] = useState(initial)
  return (
    <div className="page-comments__editor" onClick={stopBubble}>
      <textarea
        aria-label="Edit comment"
        value={text}
        rows={2}
        autoFocus
        onChange={(event) => setText(event.target.value)}
      />
      <button type="button" disabled={!text.trim()} onClick={() => submit(text.trim())}>
        Save
      </button>
      <button type="button" onClick={cancel}>
        Cancel
      </button>
    </div>
  )
}

function ReplyComposer({
  label,
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  readonly label: string
  readonly placeholder: string
  readonly submitLabel: string
  readonly onSubmit: (text: string) => void
  readonly onCancel?: () => void
}) {
  const [text, setText] = useState('')
  const send = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setText('')
  }
  return (
    <div className="page-comments__reply page-comment-composer" onClick={stopBubble}>
      <textarea
        aria-label={label}
        placeholder={placeholder}
        rows={2}
        value={text}
        autoFocus
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && onCancel) {
            event.preventDefault()
            onCancel()
          }
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && text.trim()) {
            event.preventDefault()
            send()
          }
        }}
      />
      <div className="page-comment-composer__footer">
        {onCancel && (
          <button type="button" className="page-comments__reply-cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" className="page-comment-composer__submit" disabled={!text.trim()} onClick={send}>
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

function MessageBlock({
  editor,
  thread,
  message,
  depth,
  editingId,
  setEditingId,
  replyingToId,
  setReplyingToId,
  onDeleteMessage,
}: {
  readonly editor: Editor
  readonly thread: CommentThread
  readonly message: CommentMessage
  readonly depth: number
  readonly editingId: string | null
  readonly setEditingId: (id: string | null) => void
  readonly replyingToId: string | null
  readonly setReplyingToId: (id: string | null) => void
  readonly onDeleteMessage: (messageId: string) => void
}) {
  const store = getCommentStore(editor)
  return (
    <article className={`page-comments__message${depth > 0 ? ' is-reply' : ''}`} onClick={stopBubble}>
      <p className="page-comments__byline">
        <span className="page-comments__author">{message.author}</span>
        <span className="page-comments__dot" aria-hidden="true">
          ·
        </span>
        <time dateTime={new Date(message.createdAt).toISOString()}>{formatTime(message.createdAt)}</time>
        {message.editedAt && editingId !== message.id && (
          <>
            <span className="page-comments__dot" aria-hidden="true">
              ·
            </span>
            <span className="page-comments__edited">edited</span>
          </>
        )}
      </p>
      {editingId === message.id ? (
        <MessageEditor
          initial={message.text}
          submit={(text) => {
            store.editMessage(thread.id, message.id, text)
            setEditingId(null)
          }}
          cancel={() => setEditingId(null)}
        />
      ) : (
        <p className="page-comments__text">{message.text}</p>
      )}
      {editingId !== message.id && replyingToId !== message.id && (
        <div className="page-comments__message-actions">
          {thread.status === 'open' && (
            <button type="button" onClick={() => setReplyingToId(message.id)}>
              Reply
            </button>
          )}
          <button type="button" onClick={() => setEditingId(message.id)}>
            Edit
          </button>
          <button type="button" className="is-danger" onClick={() => onDeleteMessage(message.id)}>
            Delete
          </button>
        </div>
      )}
      {thread.status === 'open' && replyingToId === message.id && (
        <ReplyComposer
          label="Nested reply"
          placeholder="Reply…"
          submitLabel="Reply"
          onCancel={() => setReplyingToId(null)}
          onSubmit={(text) => {
            store.reply(thread.id, text, message.id)
            setReplyingToId(null)
          }}
        />
      )}
    </article>
  )
}

function MessageTree({
  editor,
  thread,
  nodes,
  depth,
  editingId,
  setEditingId,
  replyingToId,
  setReplyingToId,
  onDeleteMessage,
  expandedReplies,
  onToggleReplies,
}: {
  readonly editor: Editor
  readonly thread: CommentThread
  readonly nodes: readonly CommentMessageNode[]
  readonly depth: number
  readonly editingId: string | null
  readonly setEditingId: (id: string | null) => void
  readonly replyingToId: string | null
  readonly setReplyingToId: (id: string | null) => void
  readonly onDeleteMessage: (messageId: string) => void
  readonly expandedReplies: ReadonlySet<string>
  readonly onToggleReplies: (messageId: string) => void
}) {
  return (
    <>
      {nodes.map((node) => {
        const replyCount = countReplyTree(node.children)
        const repliesOpen = expandedReplies.has(node.message.id)
        return (
          <div className="page-comments__message-group" key={node.message.id}>
            <MessageBlock
              editor={editor}
              thread={thread}
              message={node.message}
              depth={depth}
              editingId={editingId}
              setEditingId={setEditingId}
              replyingToId={replyingToId}
              setReplyingToId={setReplyingToId}
              onDeleteMessage={onDeleteMessage}
            />
            {replyCount > 0 &&
              (repliesOpen ? (
                <div className="page-comments__replies">
                  <button
                    type="button"
                    className="page-comments__replies-toggle is-open"
                    onClick={(event) => {
                      stopBubble(event)
                      onToggleReplies(node.message.id)
                    }}
                  >
                    Hide replies
                  </button>
                  <MessageTree
                    editor={editor}
                    thread={thread}
                    nodes={node.children}
                    depth={depth + 1}
                    editingId={editingId}
                    setEditingId={setEditingId}
                    replyingToId={replyingToId}
                    setReplyingToId={setReplyingToId}
                    onDeleteMessage={onDeleteMessage}
                    expandedReplies={expandedReplies}
                    onToggleReplies={onToggleReplies}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="page-comments__replies-toggle"
                  onClick={(event) => {
                    stopBubble(event)
                    onToggleReplies(node.message.id)
                  }}
                >
                  {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                </button>
              ))}
          </div>
        )
      })}
    </>
  )
}

function ThreadCard({
  editor,
  thread,
  selected,
  onSelect,
}: {
  readonly editor: Editor
  readonly thread: CommentThread
  readonly selected: boolean
  readonly onSelect: () => void
}) {
  const store = getCommentStore(editor)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(() => new Set())
  const toggleReplies = (messageId: string) => {
    setExpandedReplies((current) => {
      const next = new Set(current)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }
  // Keep the reply/edit branch open without syncing that into state from an effect.
  const visibleExpandedReplies = useMemo(() => {
    const focusId = replyingToId ?? editingId
    if (!focusId) return expandedReplies
    const next = new Set(expandedReplies)
    for (const id of ancestorMessageIds(thread.messages, focusId)) next.add(id)
    if (replyingToId) next.add(replyingToId)
    return next
  }, [expandedReplies, editingId, replyingToId, thread.messages])
  const deleteThread = () => deleteThreadAndAnchor(editor, thread, store)
  const deleteMessage = (messageId: string) => {
    const removeIds = collectDescendantIds(thread.messages, messageId)
    const remaining = thread.messages.filter((message) => !removeIds.has(message.id))
    if (remaining.length === 0) deleteThreadAndAnchor(editor, thread, store)
    else store.deleteMessage(thread.id, messageId)
  }
  const forest = buildMessageForest(thread.messages)
  const anchorPreview = useEditorState({
    editor,
    selector: ({ editor: current }) => getThreadAnchorPreview(current, thread.id),
  })
  const goToAnchor = () => {
    if (thread.orphaned) return
    onSelect()
    navigateToThreadAnchor(editor, thread.id)
  }
  return (
    <article
      className={`page-comments__thread${selected ? ' is-active' : ''}${thread.status === 'resolved' ? ' is-resolved' : ''}`}
      onClick={() => onSelect()}
    >
      <button
        type="button"
        className="page-comments__anchor"
        disabled={thread.orphaned}
        title={thread.orphaned ? 'This text was removed from the page' : 'Go to highlighted text'}
        onClick={(event) => {
          stopBubble(event)
          goToAnchor()
        }}
      >
        <span className="page-comments__anchor-kicker">
          {thread.orphaned ? 'Removed from page' : thread.anchorKind === 'block' ? 'On block' : 'On text'}
        </span>
        <span className="page-comments__anchor-quote">
          {thread.orphaned
            ? 'The anchor was deleted — resolve or delete this thread'
            : (anchorPreview?.text ?? 'Go to comment in document')}
        </span>
      </button>
      <div className="page-comments__messages">
        <MessageTree
          editor={editor}
          thread={thread}
          nodes={forest}
          depth={0}
          editingId={editingId}
          setEditingId={setEditingId}
          replyingToId={replyingToId}
          setReplyingToId={setReplyingToId}
          onDeleteMessage={deleteMessage}
          expandedReplies={visibleExpandedReplies}
          onToggleReplies={toggleReplies}
        />
      </div>
      <div className="page-comments__thread-footer" onClick={stopBubble}>
        {thread.status === 'open' && replyingToId === null && (
          <ReplyComposer
            label="Reply"
            placeholder="Reply to thread…"
            submitLabel="Reply"
            onSubmit={(text) => store.reply(thread.id, text)}
          />
        )}
        <div className="page-comments__thread-actions">
          {thread.status === 'open' ? (
            <button type="button" onClick={() => store.resolve(thread.id)}>
              Resolve
            </button>
          ) : (
            <button type="button" onClick={() => store.reopen(thread.id)}>
              Reopen
            </button>
          )}
          <button
            type="button"
            className="is-danger"
            disabled={!editor.isEditable}
            title={editor.isEditable ? 'Delete thread' : 'Page is locked'}
            onClick={deleteThread}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}

/** The comments side panel (F1): open and resolved threads, replies, resolve/reopen, delete. */
export function CommentsPanel({ editor, ui: _ui }: { readonly editor: Editor; readonly ui: EditorUiStores }) {
  const store = getCommentStore(editor)
  const threads = useSyncExternalStore(store.subscribe, () => store.list())
  const selected = useSyncExternalStore(commentsUi.subscribe, commentsUi.getSelected)
  const [showResolved, setShowResolved] = useState(false)
  const open = threads.filter((thread) => thread.status === 'open')
  const resolved = threads.filter((thread) => thread.status === 'resolved')
  const visible = showResolved ? resolved : open
  return (
    <div className="page-comments">
      {store.isPersistenceDegraded() && (
        <p className="page-comments__warning" role="alert">
          Local storage is full - new comments are kept in memory only and will be lost on reload.
        </p>
      )}
      {store.droppedCorrupt > 0 && (
        <p className="page-comments__warning" role="alert">
          {store.droppedCorrupt} stored comment{store.droppedCorrupt === 1 ? '' : 's'} could not be read and{' '}
          {store.droppedCorrupt === 1 ? 'was' : 'were'} skipped.
        </p>
      )}
      <div className="page-comments__tabs" role="tablist" aria-label="Comment filters">
        <button
          type="button"
          role="tab"
          aria-selected={!showResolved}
          className={!showResolved ? 'is-active' : undefined}
          onClick={() => setShowResolved(false)}
        >
          Open ({open.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={showResolved}
          className={showResolved ? 'is-active' : undefined}
          onClick={() => setShowResolved(true)}
        >
          Resolved ({resolved.length})
        </button>
      </div>
      {visible.length === 0 && (
        <p className="page-comments__empty">
          {showResolved ? 'No resolved comments.' : 'No open comments. Select text and choose Comment to start one.'}
        </p>
      )}
      {visible.map((thread) => (
        <ThreadCard
          key={thread.id}
          editor={editor}
          thread={thread}
          selected={thread.id === selected}
          onSelect={() => commentsUi.select(thread.id)}
        />
      ))}
    </div>
  )
}
