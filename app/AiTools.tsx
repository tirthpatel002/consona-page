import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'
import { Settings2, Sparkles } from 'lucide-react'
import type { PageSettingsStore } from '../src/editor/core'
import { createPageEngine, type PagesEngine } from '../src/editor/engine'
import {
  captureAiTargets,
  createAiReviewController,
  createMockAiProvider,
  type AiAction,
} from '../src/plugins/ai-review'
import { inlineToMarkdown } from '../src/plugins/export/markdown'
import type { DocNode } from '../src/plugins/export/types'
import { PageSettingsModal } from './PageSettingsModal'
import { AiDialog } from './AiDialog'
import './ai-tools.css'

/** Host supplies the attached page engine. This demo always uses the local mock, never a remote provider. */
export function AiTools({
  editor,
  pageId,
  engine,
  settings,
}: {
  readonly editor: Editor
  readonly pageId: string
  readonly engine: PagesEngine
  readonly settings: PageSettingsStore
}) {
  const provider = useMemo(() => createMockAiProvider(), [])
  const controller = useMemo(
    () => createAiReviewController({ pageId, engine, settings, provider }),
    [pageId, engine, settings, provider],
  )
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [neverAsk, setNeverAsk] = useState(false)
  const [action, setAction] = useState<AiAction>('uppercase')
  const [scope, setScope] = useState<'selection' | 'page'>('selection')
  const [launchError, setLaunchError] = useState('')
  const [undoMessage, setUndoMessage] = useState('')
  const [undoBusy, setUndoBusy] = useState(false)
  useEffect(() => () => controller.discard(), [controller])
  const [snapshot, setSnapshot] = useState<{
    selection: ReturnType<typeof captureAiTargets>
    page: ReturnType<typeof captureAiTargets>
    revision: string
  } | null>(null)
  const busy = state.phase === 'generating' || state.phase === 'applying'
  const openActions = async () => {
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
      setLaunchError('Could not read this page. Nothing was changed.')
      return
    }
    if (!read.ok || read.revision !== captured.revision) {
      setLaunchError('The page changed or could not be read. Select the content again.')
      return
    }
    setLaunchError('')
    setUndoMessage('')
    setSnapshot({ ...captured, revision: read.revision })
    setNeverAsk(false)
    setActionsOpen(true)
  }
  const close = () => {
    if (!busy && !undoBusy) {
      controller.discard()
      setActionsOpen(false)
    }
  }
  return (
    <div className="ai-tools">
      <button type="button" title="AI actions (local demo)" onClick={() => void openActions()}>
        <Sparkles size={16} />
        <span>AI actions</span>
      </button>
      <button type="button" title="Page settings" onClick={() => setSettingsOpen(true)}>
        <Settings2 size={16} />
        <span>Page settings</span>
      </button>
      {launchError && <p role="alert">{launchError}</p>}
      {settingsOpen && (
        <PageSettingsModal key={pageId} pageId={pageId} settings={settings} close={() => setSettingsOpen(false)} />
      )}
      {actionsOpen && (
        <AiDialog title="AI actions" close={close} busy={state.phase === 'applying' || undoBusy}>
          <p className="ai-muted">{provider.disclosure}</p>
          {state.phase === 'idle' && (
            <>
              <label className="ai-field">
                Scope
                <select value={scope} onChange={(event) => setScope(event.target.value as 'selection' | 'page')}>
                  <option value="selection">Selected text / blocks (or current text block)</option>
                  <option value="page">All text blocks on this page</option>
                </select>
              </label>
              <label className="ai-field">
                Action
                <select value={action} onChange={(event) => setAction(event.target.value as AiAction)}>
                  <option value="uppercase">Uppercase text (demo)</option>
                  <option value="summarize">Add a short excerpt (demo)</option>
                </select>
              </label>
              <p className="ai-muted">
                Media and non-text blocks are not changed. Review is on by default; this page's saved preference is
                respected.
              </p>
              <footer className="ai-dialog__actions">
                <button type="button" onClick={close}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (snapshot) void controller.generate(action, snapshot[scope], snapshot.revision)
                  }}
                >
                  Prepare changes
                </button>
              </footer>
            </>
          )}
          {state.phase === 'generating' && (
            <>
              <p role="status">Preparing local changes…</p>
              <button type="button" onClick={close}>
                Cancel
              </button>
            </>
          )}
          {state.proposal && (state.phase === 'review' || state.phase === 'applying' || state.phase === 'error') && (
            <>
              <p>{state.proposal.summary}</p>
              <details>
                <summary>Before (compact text)</summary>
                <pre>{state.proposal.before}</pre>
              </details>
              <h3>Proposed edits</h3>
              <ol className="ai-changes">
                {state.proposal.steps.map((step, index) => (
                  <li key={index}>
                    <small>
                      {step.op} · {step.id}
                    </small>
                    <pre>{'text' in step ? step.text : JSON.stringify(step)}</pre>
                  </li>
                ))}
              </ol>
            </>
          )}
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
          {undoMessage && <p role="status">{undoMessage}</p>}
          {state.message && <p role={state.phase === 'error' ? 'alert' : 'status'}>{state.message}</p>}
          {(state.phase === 'done' || state.phase === 'error') && (
            <footer className="ai-dialog__actions">
              <button type="button" disabled={undoBusy} onClick={close}>
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
              {state.phase === 'done' && (
                <button
                  type="button"
                  disabled={undoBusy || undoMessage === 'Changes undone.'}
                  onClick={() => {
                    setUndoBusy(true)
                    void engine
                      .undo(pageId)
                      .then(
                        (result) =>
                          setUndoMessage(
                            result.ok ? 'Changes undone.' : result.errors.map((error) => error.message).join(' '),
                          ),
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
        </AiDialog>
      )}
    </div>
  )
}
