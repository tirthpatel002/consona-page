import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  forwardRef,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import type { Editor } from '@tiptap/core'
import { Settings2, Sparkles } from 'lucide-react'
import type { PageSettingsStore } from '../src/editor/core'
import { createPageEngine, type PagesEngine } from '../src/editor/engine'
import {
  captureAiTargets,
  createAiReviewController,
  createMockAiProvider,
  type AiAction,
  type AiTarget,
} from '../src/plugins/ai-review'
import { inlineToMarkdown } from '../src/plugins/export/markdown'
import type { DocNode } from '../src/plugins/export/types'
import { PageSettingsModal } from './PageSettingsModal'
import { AiDialog } from './AiDialog'
import { showToast } from './toast'
import './ai-tools.css'

export interface AiToolsHandle {
  readonly openActions: () => Promise<void>
}

type ChatMessage =
  | { readonly id: string; readonly role: 'selection'; readonly text: string }
  | { readonly id: string; readonly role: 'user'; readonly text: string }
  | { readonly id: string; readonly role: 'assistant'; readonly text: string }
  | { readonly id: string; readonly role: 'status'; readonly text: string; readonly tone?: 'error' }

function inferAction(prompt: string): AiAction {
  return /\b(summar|excerpt|tl;?dr)\b/i.test(prompt) ? 'summarize' : 'uppercase'
}

function selectionPreview(targets: readonly AiTarget[]): string {
  return targets
    .map((target) => target.selected)
    .join('\n\n')
    .trim()
}

/** Host supplies the attached page engine. This demo always uses the local mock, never a remote provider. */
export const AiTools = forwardRef<
  AiToolsHandle,
  {
    readonly editor: Editor
    readonly pageId: string
    readonly engine: PagesEngine
    readonly settings: PageSettingsStore
  }
>(function AiTools({ editor, pageId, engine, settings }, ref) {
  const provider = useMemo(() => createMockAiProvider(), [])
  const controller = useMemo(
    () => createAiReviewController({ pageId, engine, settings, provider }),
    [pageId, engine, settings, provider],
  )
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [neverAsk, setNeverAsk] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<readonly ChatMessage[]>([])
  const [undoMessage, setUndoMessage] = useState('')
  const [undoBusy, setUndoBusy] = useState(false)
  const [undone, setUndone] = useState(false)
  const closeButton = useRef<HTMLButtonElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (undone && !undoBusy) closeButton.current?.focus()
  }, [undone, undoBusy])
  useEffect(() => () => controller.discard(), [controller])
  useEffect(() => {
    const root = threadRef.current
    if (!root) return
    root.scrollTop = root.scrollHeight
  }, [messages, state.phase, state.proposal, state.message, undoMessage])
  const [snapshot, setSnapshot] = useState<{
    selection: ReturnType<typeof captureAiTargets>
    page: ReturnType<typeof captureAiTargets>
    revision: string
  } | null>(null)
  const busy = state.phase === 'generating' || state.phase === 'applying'
  const targetsForChat = snapshot?.selection.length ? snapshot.selection : (snapshot?.page ?? [])
  const openActions = useCallback(async () => {
    const serialize = (node: Parameters<typeof captureAiTargets>[0]['state']['doc']) =>
      node.type.name === 'codeBlock'
        ? node.textContent
        : inlineToMarkdown(node.toJSON().content as DocNode[] | undefined)
    const captured = {
      selection: captureAiTargets(editor, serialize),
      page: captureAiTargets(editor, serialize, true),
      revision: createPageEngine({ editor }).revision(),
    }
    let read
    try {
      read = await engine.readCompact(pageId, { maxChars: 1, maxLines: 1 })
    } catch {
      showToast('Could not read this page. Nothing was changed.', { tone: 'error' })
      return
    }
    if (!read.ok || read.revision !== captured.revision) {
      showToast('The page changed or could not be read. Select the content again.', { tone: 'error' })
      return
    }
    const previewTargets = captured.selection.length > 0 ? captured.selection : captured.page
    const preview = selectionPreview(previewTargets)
    setUndoMessage('')
    setUndone(false)
    setDraft('')
    setMessages(
      preview
        ? [{ id: 'selection', role: 'selection', text: preview }]
        : [{ id: 'empty', role: 'status', text: 'Nothing is selected yet. Select text or blocks, then open AI again.', tone: 'error' }],
    )
    setSnapshot({ ...captured, revision: read.revision })
    setNeverAsk(false)
    setActionsOpen(true)
  }, [editor, engine, pageId])
  useImperativeHandle(ref, () => ({ openActions }), [openActions])
  useEffect(() => {
    if (actionsOpen && state.phase === 'idle') composerRef.current?.focus()
  }, [actionsOpen, state.phase])
  const close = () => {
    if (!busy && !undoBusy) {
      controller.discard()
      setActionsOpen(false)
    }
  }
  const sendPrompt = (prompt: string) => {
    const trimmed = prompt.trim()
    if (!trimmed || !snapshot || busy || undoBusy) return
    if (targetsForChat.length === 0) {
      setMessages((previous) => [
        ...previous,
        { id: crypto.randomUUID(), role: 'status', text: 'Choose text or a text block first.', tone: 'error' },
      ])
      return
    }
    setDraft('')
    setMessages((previous) => [...previous, { id: crypto.randomUUID(), role: 'user', text: trimmed }])
    void controller.generate(inferAction(trimmed), targetsForChat, snapshot.revision)
  }
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    sendPrompt(draft)
  }
  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendPrompt(draft)
    }
  }
  useEffect(() => {
    if (state.phase === 'review' && state.proposal) {
      setMessages((previous) => {
        const last = previous[previous.length - 1]
        if (last?.role === 'assistant' && last.text === state.proposal?.summary) return previous
        return [...previous, { id: crypto.randomUUID(), role: 'assistant', text: state.proposal.summary }]
      })
    }
  }, [state.phase, state.proposal])
  useEffect(() => {
    if (state.phase === 'generating') {
      setMessages((previous) => {
        if (previous.some((message) => message.role === 'status' && message.text === 'Preparing local changes…')) {
          return previous
        }
        return [...previous, { id: 'generating', role: 'status', text: 'Preparing local changes…' }]
      })
      return
    }
    setMessages((previous) =>
      previous.filter((message) => !(message.role === 'status' && message.text === 'Preparing local changes…')),
    )
  }, [state.phase])
  useEffect(() => {
    if (!state.message || undone) return
    setMessages((previous) => {
      const last = previous[previous.length - 1]
      if (last?.role === 'status' && last.text === state.message) return previous
      return [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: 'status',
          text: state.message,
          tone: state.phase === 'error' ? 'error' : undefined,
        },
      ]
    })
  }, [state.message, state.phase, undone])

  return (
    <div className="page-toolbar__group ai-tools">
      <button type="button" title="AI actions (local demo)" aria-label="AI actions" onClick={() => void openActions()}>
        <Sparkles size={16} aria-hidden="true" />
      </button>
      <button type="button" title="Page settings" aria-label="Page settings" onClick={() => setSettingsOpen(true)}>
        <Settings2 size={16} aria-hidden="true" />
      </button>
      {settingsOpen && (
        <PageSettingsModal key={pageId} pageId={pageId} settings={settings} close={() => setSettingsOpen(false)} />
      )}
      {actionsOpen && (
        <AiDialog title="AI actions" close={close} busy={state.phase === 'applying' || undoBusy}>
          <p className="ai-muted">{provider.disclosure}</p>
          <div className="ai-chat" aria-label="AI chat">
            <div className="ai-chat__thread" ref={threadRef} role="log" aria-live="polite">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`ai-chat__message ai-chat__message--${message.role}${
                    message.role === 'status' && message.tone === 'error' ? ' is-error' : ''
                  }`}
                >
                  {message.role === 'selection' && <span className="ai-chat__eyebrow">Selected content</span>}
                  {message.role === 'assistant' && <span className="ai-chat__eyebrow">Proposal</span>}
                  <div className="ai-chat__bubble">
                    {message.role === 'selection' || message.role === 'assistant' ? (
                      <pre>{message.text}</pre>
                    ) : (
                      <p>{message.text}</p>
                    )}
                  </div>
                </div>
              ))}
              {state.proposal && (state.phase === 'review' || state.phase === 'applying' || state.phase === 'error') && (
                <div className="ai-chat__message ai-chat__message--assistant">
                  <span className="ai-chat__eyebrow">Proposed edits</span>
                  <div className="ai-chat__bubble">
                    <details>
                      <summary>Before (compact text)</summary>
                      <pre>{state.proposal.before}</pre>
                    </details>
                    <ol className="ai-changes">
                      {state.proposal.steps.map((step, index) => (
                        <li key={index}>
                          <small>
                            {step.op === 'replaceMarkdown' ? 'Replace chosen text' : 'Add text after chosen block'}
                          </small>
                          <details>
                            <summary>Technical details</summary>
                            <small>
                              {step.op} · {step.id}
                            </small>
                          </details>
                          <pre>{'text' in step ? step.text : JSON.stringify(step)}</pre>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
              {undoMessage && (
                <div className="ai-chat__message ai-chat__message--status">
                  <div className="ai-chat__bubble">
                    <p role="status">{undoMessage}</p>
                  </div>
                </div>
              )}
            </div>

            {state.phase === 'review' && (
              <>
                <label className="ai-check">
                  <input type="checkbox" checked={neverAsk} onChange={(event) => setNeverAsk(event.target.checked)} />
                  Never ask me again on this page
                </label>
                <p className="ai-muted">
                  You can turn review back on in Page settings. This takes effect only if Accept succeeds.
                </p>
                <footer className="ai-dialog__actions">
                  <button type="button" onClick={close}>
                    Discard
                  </button>
                  <button type="button" onClick={() => void controller.accept(neverAsk)}>
                    Accept
                  </button>
                </footer>
              </>
            )}
            {state.phase === 'applying' && <p role="status">Applying validated changes…</p>}
            {(state.phase === 'done' || state.phase === 'error') && (
              <footer className="ai-dialog__actions">
                <button type="button" ref={closeButton} disabled={undoBusy} onClick={close}>
                  Close
                </button>
                {state.phase === 'error' && (
                  <button
                    type="button"
                    onClick={() => {
                      controller.discard()
                      void openActions()
                    }}
                  >
                    Select again / re-run
                  </button>
                )}
                {state.phase === 'done' && !undone && (
                  <button
                    type="button"
                    disabled={undoBusy}
                    onClick={() => {
                      setUndoBusy(true)
                      void engine
                        .undo(pageId)
                        .then(
                          (result) => {
                            if (result.ok) {
                              setUndone(true)
                              setMessages((previous) =>
                                previous.filter(
                                  (message) =>
                                    !(message.role === 'status' && message.text === 'Changes applied.'),
                                ),
                              )
                            }
                            setUndoMessage(
                              result.ok ? 'Changes undone.' : result.errors.map((error) => error.message).join(' '),
                            )
                          },
                          () => setUndoMessage('Could not confirm undo. Read the page before retrying.'),
                        )
                        .finally(() => setUndoBusy(false))
                    }}
                  >
                    Undo changes
                  </button>
                )}
              </footer>
            )}

            {(state.phase === 'idle' || state.phase === 'generating') && (
              <form className="ai-chat__composer" onSubmit={onSubmit}>
                <div className="ai-chat__suggestions" aria-label="Demo prompts">
                  <button type="button" disabled={busy} onClick={() => sendPrompt('Uppercase the selected text')}>
                    Uppercase
                  </button>
                  <button type="button" disabled={busy} onClick={() => sendPrompt('Summarize with a short excerpt')}>
                    Summarize
                  </button>
                </div>
                <textarea
                  ref={composerRef}
                  value={draft}
                  disabled={busy}
                  rows={3}
                  placeholder="Ask what to do with the selected content…"
                  aria-label="Message"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onComposerKeyDown}
                />
                <footer className="ai-dialog__actions">
                  <button type="button" onClick={close} disabled={busy}>
                    Cancel
                  </button>
                  <button type="submit" disabled={busy || !draft.trim()}>
                    Send
                  </button>
                </footer>
              </form>
            )}
          </div>
        </AiDialog>
      )}
    </div>
  )
})
