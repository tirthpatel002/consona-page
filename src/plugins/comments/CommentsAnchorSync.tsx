import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { useEffect, useSyncExternalStore } from 'react'
import type { Transaction } from '@tiptap/pm/state'
import { Popover, type EditorUiStores } from '../../editor/core'
import { CommentComposer } from './CommentComposer'
import { markDanglingAnchors } from './dangling'
import { getCommentStore } from './store'
import { commentsUi } from './uiStore'

/**
 * Keeps the store and panel in step with the document: mirrors orphan state after every
 * transaction, and clicking a comment highlight selects its thread and opens the panel.
 */
export function CommentsAnchorSync({ editor, ui }: { readonly editor: Editor; readonly ui: EditorUiStores }) {
  const threadIdAtSelection = useEditorState({
    editor,
    selector: ({ editor: current }): string | null => {
      const mark = current.state.selection.$from.marks().find((candidate) => candidate.type.name === 'comment')
      return (mark?.attrs.threadId as string | undefined) ?? null
    },
  })
  useEffect(() => {
    if (!threadIdAtSelection) return
    // Dangling anchors (thread deleted) are inert: clicking them does not open the panel.
    if (!getCommentStore(editor).get(threadIdAtSelection)) return
    commentsUi.select(threadIdAtSelection)
    ui.panels.show('comments')
  }, [threadIdAtSelection, ui, editor])
  // Open requests from components without panel access (e.g. the bubble composer).
  const openTick = useSyncExternalStore(commentsUi.subscribe, commentsUi.getOpenTick)
  useEffect(() => {
    if (openTick > 0) ui.panels.show('comments')
  }, [openTick, ui])
  useEffect(() => {
    const store = getCommentStore(editor)
    const sync = ({ transaction }: { transaction: Transaction }) => {
      store.syncWithDocument(editor, transaction)
      markDanglingAnchors(editor, store)
    }
    editor.on('transaction', sync)
    store.syncWithDocument(editor)
    markDanglingAnchors(editor, store)
    return () => {
      editor.off('transaction', sync)
    }
  }, [editor])
  // Block-menu composer, anchored at the block's position.
  const blockPos = useSyncExternalStore(commentsUi.subscribe, commentsUi.getBlockComposerPos)
  if (blockPos === null) return null
  const anchor = ((): DOMRect | null => {
    try {
      const coords = editor.view.coordsAtPos(blockPos)
      return new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top)
    } catch {
      return null
    }
  })()
  if (!anchor) return null
  return (
    <Popover anchor={anchor} label="Add block comment" onClose={() => commentsUi.closeBlockComposer()}>
      <CommentComposer editor={editor} close={() => commentsUi.closeBlockComposer()} blockPos={blockPos} />
    </Popover>
  )
}
