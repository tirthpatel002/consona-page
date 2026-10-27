import type { PageSettingsStore } from '../../editor/core'
import type { EditOutcome, PagesEngine, Step } from '../../editor/engine'

export type AiAction = 'uppercase' | 'summarize'
export interface AiTarget {
  readonly id: string
  readonly before: string
  readonly selected: string
  readonly after: string
  readonly uppercaseMarkdown: string
}
export interface AiContext {
  readonly pageId: string
  readonly action: AiAction
  readonly compact: string
  readonly targets: readonly AiTarget[]
}
export interface AiProposal {
  readonly summary: string
  readonly steps: readonly Step[]
}
/** The host owns disclosure/consent before connecting any remote provider. No provider is called implicitly. */
export interface AiProvider {
  readonly label: string
  readonly disclosure: string
  propose(context: AiContext, signal: AbortSignal): Promise<AiProposal>
}
export interface ReviewProposal extends AiProposal {
  readonly requestId: string
  readonly baseRevision: string
  readonly before: string
}
export interface ReviewState {
  readonly phase: 'idle' | 'generating' | 'review' | 'applying' | 'done' | 'error'
  readonly proposal?: ReviewProposal
  readonly message?: string
}
export interface AiReviewController {
  getSnapshot(): ReviewState
  subscribe(listener: () => void): () => void
  generate(action: AiAction, targets: readonly AiTarget[], capturedRevision: string): Promise<void>
  accept(neverAskAgain?: boolean): Promise<void>
  discard(): void
}
const messageOf = (result: EditOutcome): string =>
  result.ok ? 'Changes applied.' : result.errors.map((error) => `${error.code}: ${error.message}`).join(' ')

/** Review is separate from editing: only Accept (or this page's saved apply preference) calls the engine. */
export function createAiReviewController({
  pageId,
  engine,
  settings,
  provider,
}: {
  readonly pageId: string
  readonly engine: Pick<PagesEngine, 'readCompact' | 'edit'>
  readonly settings: PageSettingsStore
  readonly provider: AiProvider
}): AiReviewController {
  let state: ReviewState = { phase: 'idle' }
  let generation = 0
  let abort: AbortController | null = null
  const listeners = new Set<() => void>()
  const publish = (next: ReviewState) => {
    state = next
    listeners.forEach((listener) => listener())
  }
  const apply = async (proposal: ReviewProposal, neverAskAgain: boolean) => {
    publish({ phase: 'applying', proposal })
    try {
      // No direct writes: lock, schema, stale checks and duplicate requests still belong to the engine.
      const result = await engine.edit(pageId, {
        baseRevision: proposal.baseRevision,
        requestId: proposal.requestId,
        steps: proposal.steps,
      })
      if (!result.ok) {
        publish({ phase: 'error', proposal, message: messageOf(result) })
        return
      }
      if (neverAskAgain) {
        try {
          await settings.set(pageId, { aiReview: 'apply' })
        } catch {
          publish({
            phase: 'done',
            message: 'Changes applied, but the review preference could not be saved. Review will still be requested.',
          })
          return
        }
      }
      publish({ phase: 'done', message: messageOf(result) })
    } catch {
      publish({
        phase: 'error',
        proposal,
        message: 'Could not confirm the edit. Read the page before retrying; the engine request id is unchanged.',
      })
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    async generate(action, targets, capturedRevision) {
      if (state.phase === 'applying' || state.phase === 'generating' || state.phase === 'review') return
      const token = ++generation
      abort?.abort()
      abort = new AbortController()
      const signal = abort.signal
      const current = () => token === generation && !signal.aborted
      publish({ phase: 'generating' })
      try {
        if (targets.length === 0) throw new Error('Choose text or a text block first.')
        const preference = await settings.get(pageId)
        if (!current()) return
        if (preference.locked) throw new Error('This page is locked. Unlock it before requesting changes.')
        const read = await engine.readCompact(pageId, {
          ids: targets.map((target) => target.id),
          maxChars: 20000,
          maxLines: 200,
        })
        if (!current()) return
        if (!read.ok) throw new Error(read.errors.map((error) => error.message).join(' '))
        if (read.revision !== capturedRevision)
          throw new Error('The page changed after selection. Select the content again.')
        if (read.truncated) throw new Error('This selection is too large. Choose fewer blocks.')
        const result = await provider.propose({ pageId, action, compact: read.text, targets }, signal)
        if (!current()) return
        const allowed = new Set(targets.map((target) => target.id))
        if (
          result.steps.length === 0 ||
          result.steps.length > 200 ||
          result.steps.some(
            (step) => !allowed.has(step.id) || (step.op !== 'replaceMarkdown' && step.op !== 'insertMarkdownAfter'),
          )
        ) {
          throw new Error('The proposed changes exceed the selected scope. Nothing was changed.')
        }
        // Copy data so a provider cannot change already-reviewed words later.
        const proposal: ReviewProposal = JSON.parse(
          JSON.stringify({ ...result, requestId: crypto.randomUUID(), baseRevision: read.revision, before: read.text }),
        ) as ReviewProposal
        const latestPreference = await settings.get(pageId)
        if (!current()) return
        if (latestPreference.aiReview === 'apply') await apply(proposal, false)
        else publish({ phase: 'review', proposal })
      } catch (error) {
        if (current())
          publish({
            phase: 'error',
            message: error instanceof Error ? error.message : 'Could not prepare changes. Nothing was changed.',
          })
      }
    },
    async accept(neverAskAgain = false) {
      if (state.phase !== 'review' || !state.proposal) return
      await apply(state.proposal, neverAskAgain)
    },
    discard() {
      // A dispatched edit cannot be cancelled. Do not imply otherwise while it is applying.
      if (state.phase === 'applying') return
      ++generation
      abort?.abort()
      publish({ phase: 'idle' })
    },
  }
}

/** A deterministic local adapter for exercising review. No network, model or credentials. */
export function createMockAiProvider(): AiProvider {
  return {
    label: 'Local demo',
    disclosure: 'Local demo only. No model is connected and no content is sent anywhere.',
    propose(context, signal) {
      if (signal.aborted) return Promise.reject(new Error('Cancelled.'))
      if (context.action === 'uppercase')
        return Promise.resolve({
          summary: 'Uppercase the chosen text (local demo).',
          steps: context.targets.map((target) => ({
            op: 'replaceMarkdown',
            id: target.id,
            text: target.uppercaseMarkdown,
          })),
        })
      const last = context.targets[context.targets.length - 1]
      const text = context.targets
        .map((target) => target.selected)
        .join(' ')
        .replace(/\s+/g, ' ')
        .slice(0, 240)
      return Promise.resolve({
        summary: 'Add a short excerpt after the chosen blocks (local demo, not an AI summary).',
        steps: [{ op: 'insertMarkdownAfter', id: last.id, text: `Excerpt: ${text}` }],
      })
    },
  }
}
