import { useEffect, useState } from 'react'
import type { Editor, JSONContent } from '@tiptap/core'
import { removeSelectedAfterHandoff, setSelectionHost } from '../src/plugins/block-selection'
import { AiDialog } from './AiDialog'
import { demoPages, demoRegistry, getCurrentPageId } from './demoSession'
import { openPageById } from './navigation'
import { showToast } from './toast'

type MoveRequest = {
  readonly editor: Editor
  readonly blocks: readonly JSONContent[]
}

async function livePages(parentId: string | null, depth = 0): Promise<{ id: string; title: string }[]> {
  if (depth > 12) return []
  const out: { id: string; title: string }[] = []
  for (const record of await demoRegistry.children(parentId)) {
    out.push({ id: record.id, title: record.title || 'Untitled' })
    out.push(...(await livePages(record.id, depth + 1)))
  }
  return out
}

/** Registers page/AI selection-bar hooks for the demo app. */
export function SelectionHostBridge({
  onAiActions,
}: {
  readonly onAiActions: (editor: Editor) => void | Promise<void>
}) {
  const [move, setMove] = useState<MoveRequest | null>(null)
  const [pages, setPages] = useState<readonly { id: string; title: string }[]>([])
  const [destination, setDestination] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSelectionHost({
      openAiActions: onAiActions,
      createPageWith: async (editor, blocks) => {
        try {
          const created = await demoRegistry.create({ title: 'Untitled' })
          await demoPages.put(created.id, { type: 'doc', content: [...blocks] })
          removeSelectedAfterHandoff(editor)
          showToast(`Created "${created.title || 'Untitled'}".`)
          openPageById(created.id)
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Could not create the page.', { tone: 'error' })
        }
      },
      moveToPage: (editor, blocks) => {
        setDestination('')
        setMove({ editor, blocks })
        void livePages(null)
          .then((records) => setPages(records.filter((r) => r.id !== getCurrentPageId())))
          .catch(() => {
            showToast('Could not read the page list.', { tone: 'error' })
            setMove(null)
          })
      },
    })
    return () => setSelectionHost({})
  }, [onAiActions])

  if (!move) return null

  const confirm = async () => {
    if (!destination) return
    setBusy(true)
    try {
      const existing = await demoPages.get(destination)
      const doc = existing?.doc as JSONContent | undefined
      const content = [...(Array.isArray(doc?.content) ? doc.content : []), ...move.blocks]
      await demoPages.put(destination, { type: 'doc', content })
      removeSelectedAfterHandoff(move.editor)
      const title = pages.find((p) => p.id === destination)?.title ?? 'page'
      showToast(`Moved blocks to "${title}".`)
      setMove(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not move the blocks.', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AiDialog title="Move to page" close={() => !busy && setMove(null)} busy={busy}>
      <p className="ai-muted">Choose a page. The selected blocks will be appended there and removed from this page.</p>
      <div className="pages-move-destinations" role="listbox" aria-label="Destination page">
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            role="option"
            aria-selected={destination === page.id}
            className={destination === page.id ? 'is-selected' : undefined}
            onClick={() => setDestination(page.id)}
          >
            {page.title}
          </button>
        ))}
      </div>
      <footer className="ai-dialog__actions">
        <button type="button" disabled={busy} onClick={() => setMove(null)}>
          Cancel
        </button>
        <button type="button" disabled={busy || !destination} onClick={() => void confirm()}>
          Move here
        </button>
      </footer>
    </AiDialog>
  )
}
