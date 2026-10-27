// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { blockCommentAnchor } from './blockAnchor'
import { commentMark } from './commentMark'
import {
  anchorBlockCommentThread,
  anchorCommentThread,
  deleteThreadAndAnchor,
  removeBlockCommentAnchor,
} from './operations'
import { markDanglingAnchors } from './dangling'
import { getThreadAnchorPreview } from './anchorPreview'
import { buildMessageForest, countReplyTree } from './messageTree'
import { CommentStore } from './store'

let key = 0
const make = () => {
  key += 1
  const { editor, destroy } = createTestEditor({
    plugins: [{ id: 'comments', extensions: [StarterKit, commentMark, blockCommentAnchor] }],
    content: '<p>Comment on this text</p>',
  })
  const store = new CommentStore(`test:comments:${key}`)
  editor.on('transaction', ({ transaction }) => store.syncWithDocument(editor, transaction))
  return { editor, store, destroy }
}

describe('F1 comment store + anchors', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a thread, anchors it to the selection, and the anchor maps through edits', () => {
    const { editor, store, destroy } = make()
    editor.commands.setTextSelection({ from: 1, to: 8 })
    const thread = store.createThread('first comment')
    anchorCommentThread.run(editor, thread.id)
    expect(getThreadAnchorPreview(editor, thread.id)?.text).toContain('Comment')
    // Edit before the anchor: the mark must move with its text.
    editor.commands.setTextSelection(1)
    editor.commands.insertContent('Prefix. ')
    const json = JSON.stringify(editor.getJSON())
    expect(json).toContain(`"threadId":"${thread.id}"`)
    expect(store.get(thread.id)?.orphaned).toBeFalsy()
    destroy()
  })

  it('flags the thread orphaned when its text is deleted, and heals on undo', () => {
    const { editor, store, destroy } = make()
    editor.commands.setTextSelection({ from: 1, to: 8 })
    const thread = store.createThread('will be orphaned')
    anchorCommentThread.run(editor, thread.id)
    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 })
    editor.commands.deleteSelection()
    expect(store.get(thread.id)?.orphaned).toBe(true)
    editor.commands.undo()
    expect(store.get(thread.id)?.orphaned).toBeFalsy()
    destroy()
  })

  it('replies, edits own messages, resolves and reopens', () => {
    const { store, destroy } = make()
    const thread = store.createThread('root')
    store.reply(thread.id, 'reply one')
    const withReply = store.get(thread.id)
    if (!withReply) throw new Error('thread missing')
    store.editMessage(thread.id, withReply.messages[1].id, 'reply edited')
    store.resolve(thread.id)
    expect(store.get(thread.id)?.status).toBe('resolved')
    store.reopen(thread.id)
    const final = store.get(thread.id)
    if (!final) throw new Error('thread missing')
    expect(final.status).toBe('open')
    expect(final.messages[1].text).toBe('reply edited')
    expect(final.messages[1].editedAt).toBeDefined()
    destroy()
  })

  it('counts nested reply trees for collapsed UI', () => {
    const { store, destroy } = make()
    const thread = store.createThread('root')
    store.reply(thread.id, 'a')
    const a = store.get(thread.id)?.messages[1]
    if (!a) throw new Error('missing')
    store.reply(thread.id, 'b', a.id)
    const forest = buildMessageForest(store.get(thread.id)?.messages ?? [])
    expect(countReplyTree(forest[0]?.children ?? [])).toBe(2)
    destroy()
  })

  it('supports nested replies and deletes a message with its subtree', () => {
    const { store, destroy } = make()
    const thread = store.createThread('root')
    store.reply(thread.id, 'top reply')
    const top = store.get(thread.id)?.messages[1]
    if (!top) throw new Error('reply missing')
    store.reply(thread.id, 'nested', top.id)
    const nested = store.get(thread.id)?.messages[2]
    expect(nested?.parentId).toBe(top.id)
    store.deleteMessage(thread.id, top.id)
    const after = store.get(thread.id)
    expect(after?.messages.map((message) => message.text)).toEqual(['root'])
    destroy()
  })

  it('deleting the last message deletes the thread; one undo restores thread, messages, and anchor', () => {
    const { editor, store, destroy } = make()
    editor.commands.setTextSelection({ from: 1, to: 8 })
    const thread = store.createThread('short lived')
    anchorCommentThread.run(editor, thread.id)
    const current = store.get(thread.id)
    expect(current).toBeDefined()
    if (!current) return
    deleteThreadAndAnchor(editor, current, store)
    expect(store.get(thread.id)).toBeUndefined()
    expect(JSON.stringify(editor.getJSON())).not.toContain(thread.id)
    editor.commands.undo()
    expect(JSON.stringify(editor.getJSON())).toContain(`"threadId":"${thread.id}"`)
    expect(store.get(thread.id)?.messages[0].text).toBe('short lived')
    destroy()
  })

  it('persists threads across reloads keyed by document', () => {
    const { store, destroy } = make()
    store.createThread('durable')
    const reloaded = new CommentStore(`test:comments:${key}`)
    expect(reloaded.list()).toHaveLength(1)
    expect(reloaded.list()[0].messages[0].text).toBe('durable')
    destroy()
  })
})

describe('F1 block anchors + coherence edges', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('anchors a block comment, orphans it on block delete, heals on undo', () => {
    const { editor, store, destroy } = make()
    const thread = store.createThread('block note', 'block')
    anchorBlockCommentThread.run(editor, 0, thread.id)
    expect(store.get(thread.id)?.orphaned).toBeFalsy()
    expect(JSON.stringify(editor.getJSON())).toContain(`"commentThread":"${thread.id}"`)
    // delete the whole document content
    editor.commands.setTextSelection({ from: 0, to: editor.state.doc.content.size })
    editor.commands.deleteSelection()
    expect(store.get(thread.id)?.orphaned).toBe(true)
    editor.commands.undo()
    expect(store.get(thread.id)?.orphaned).toBeFalsy()
    removeBlockCommentAnchor.run(editor, thread.id)
    expect(JSON.stringify(editor.getJSON())).not.toContain(`"commentThread":"${thread.id}"`)
    destroy()
  })

  it('delete removes thread and anchor; undo restores both with messages; redo deletes again', () => {
    const { editor, store, destroy } = make()
    editor.commands.setTextSelection({ from: 1, to: 8 })
    const thread = store.createThread('doomed')
    anchorCommentThread.run(editor, thread.id)
    store.reply(thread.id, 'second message')
    const current = store.get(thread.id)
    expect(current).toBeDefined()
    if (!current) return
    deleteThreadAndAnchor(editor, current, store)
    expect(store.get(thread.id)).toBeUndefined()
    expect(JSON.stringify(editor.getJSON())).not.toContain(thread.id)
    editor.commands.undo()
    const restored = store.get(thread.id)
    expect(restored?.messages.map((message) => message.text)).toEqual(['doomed', 'second message'])
    expect(restored?.orphaned).toBeFalsy()
    expect(JSON.stringify(editor.getJSON())).toContain(thread.id)
    editor.commands.redo()
    expect(store.get(thread.id)).toBeUndefined()
    expect(JSON.stringify(editor.getJSON())).not.toContain(thread.id)
    destroy()
  })

  it('ignores anchors with an unknown thread id instead of inventing empty threads', () => {
    const { editor, store, destroy } = make()
    editor.commands.setTextSelection({ from: 1, to: 8 })
    anchorCommentThread.run(editor, 'thread-from-another-doc')
    store.syncWithDocument(editor)
    expect(store.get('thread-from-another-doc')).toBeUndefined()
    expect(store.list()).toHaveLength(0)
    destroy()
  })

  it('renders unknown-thread anchors as dangling (muted, inert), not as live comments', () => {
    const { editor, store, destroy } = make()
    editor.commands.setTextSelection({ from: 1, to: 8 })
    anchorCommentThread.run(editor, 'thread-from-another-doc')
    markDanglingAnchors(editor, store)
    const anchor = editor.view.dom.querySelector('[data-comment-thread="thread-from-another-doc"]')
    expect(anchor?.classList.contains('page-comment--dangling')).toBe(true)
    expect(anchor?.getAttribute('title')).toBe('This comment was deleted')
    // a known thread's anchor is not dangled
    const thread = store.createThread('live')
    editor.commands.setTextSelection({ from: 10, to: 16 })
    anchorCommentThread.run(editor, thread.id)
    markDanglingAnchors(editor, store)
    expect(
      editor.view.dom
        .querySelector(`[data-comment-thread="${thread.id}"]`)
        ?.classList.contains('page-comment--dangling'),
    ).toBe(false)
    destroy()
  })

  it('discloses corrupt stored entries and persistence failures', () => {
    const { destroy } = make()
    key += 1
    const storageKey = `test:comments:${key}`
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        format: 1,
        threads: [{ bogus: true }, { id: 'ok', anchorKind: 'text', messages: [], status: 'open', createdAt: 1 }],
      }),
    )
    const store = new CommentStore(storageKey)
    expect(store.list()).toHaveLength(1)
    expect(store.droppedCorrupt).toBe(1)
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
    try {
      store.createThread('unsavable')
      expect(store.isPersistenceDegraded()).toBe(true)
    } finally {
      Storage.prototype.setItem = original
    }
    store.createThread('savable again')
    expect(store.isPersistenceDegraded()).toBe(false)
    destroy()
  })
})
