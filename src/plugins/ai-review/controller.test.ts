import { describe, expect, it, vi } from 'vitest'
import { createMemorySettingsStorage, createSettingsStore } from '../../editor/core'
import { createAiReviewController, createMockAiProvider, type AiProvider, type AiTarget } from './controller'

const target: AiTarget = { id: 'b1', before: '', selected: 'hello', after: '', uppercaseMarkdown: 'HELLO' }
const setup = (provider: AiProvider = createMockAiProvider()) => {
  const settings = createSettingsStore(createMemorySettingsStorage())
  const engine = {
    readCompact: vi
      .fn()
      .mockResolvedValue({ ok: true, text: '[b1] hello', lines: 1, truncated: false, revision: 'r1' }),
    edit: vi.fn().mockResolvedValue({ ok: true, applied: 1, replayed: false, revision: 'r2' }),
  }
  const controller = createAiReviewController({ pageId: 'page1', engine, settings, provider })
  return { settings, engine, controller }
}
describe('AI review controller', () => {
  it('reviews by default, discard writes nothing', async () => {
    const { controller, engine } = setup()
    await controller.generate('uppercase', [target], 'r1')
    expect(controller.getSnapshot().phase).toBe('review')
    expect(engine.edit).not.toHaveBeenCalled()
    controller.discard()
    expect(controller.getSnapshot().phase).toBe('idle')
    expect(engine.edit).not.toHaveBeenCalled()
  })
  it('Accept writes exactly reviewed steps with captured revision, and saves opt-out only on success', async () => {
    const { controller, engine, settings } = setup()
    await controller.generate('uppercase', [target], 'r1')
    const proposal = controller.getSnapshot().proposal
    if (!proposal) throw new Error('Missing review proposal')
    await controller.accept(true)
    expect(engine.edit).toHaveBeenCalledWith('page1', {
      baseRevision: 'r1',
      requestId: proposal.requestId,
      steps: proposal.steps,
    })
    expect((await settings.get('page1')).aiReview).toBe('apply')
    expect((await settings.get('page2')).aiReview).toBe('ask')
    await controller.accept(true)
    expect(engine.edit).toHaveBeenCalledTimes(1)
  })
  it('apply preference still goes through engine and reports stale without overwriting', async () => {
    const { controller, engine, settings } = setup()
    await settings.set('page1', { aiReview: 'apply' })
    engine.edit.mockResolvedValue({ ok: false, errors: [{ code: 'stale', message: 'Changed block.' }] })
    await controller.generate('uppercase', [target], 'r1')
    expect(engine.edit).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().phase).toBe('error')
    expect(controller.getSnapshot().message).toContain('stale')
  })
  it('does not call provider for locked page', async () => {
    const provider = { ...createMockAiProvider(), propose: vi.fn() }
    const { controller, settings } = setup(provider)
    await settings.set('page1', { locked: true, aiReview: 'apply' })
    await controller.generate('uppercase', [target], 'r1')
    expect(provider.propose).not.toHaveBeenCalled()
    expect(controller.getSnapshot().phase).toBe('error')
  })
  it('a later lock or validation refusal never saves opt-out', async () => {
    const { controller, settings, engine } = setup()
    await controller.generate('uppercase', [target], 'r1')
    engine.edit.mockResolvedValue({ ok: false, errors: [{ code: 'locked', message: 'Locked.' }] })
    await controller.accept(true)
    expect((await settings.get('page1')).aiReview).toBe('ask')
  })
  it('changed selection revision refuses before provider', async () => {
    const provider = { ...createMockAiProvider(), propose: vi.fn() }
    const { controller } = setup(provider)
    await controller.generate('uppercase', [target], 'old')
    expect(provider.propose).not.toHaveBeenCalled()
    expect(controller.getSnapshot().message).toContain('changed after selection')
  })
  it('cancel ignores late provider result', async () => {
    let finish!: (value: { summary: string; steps: [] }) => void
    const provider = {
      ...createMockAiProvider(),
      propose: () =>
        new Promise<{ summary: string; steps: [] }>((resolve) => {
          finish = resolve
        }),
    }
    const { controller, engine } = setup(provider)
    const pending = controller.generate('uppercase', [target], 'r1')
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    controller.discard()
    finish({ summary: 'Late', steps: [] })
    await pending
    expect(controller.getSnapshot().phase).toBe('idle')
    expect(engine.edit).not.toHaveBeenCalled()
  })
  it('refuses provider steps outside selected scope and dangerous operations', async () => {
    const provider = {
      ...createMockAiProvider(),
      propose: vi.fn().mockResolvedValue({ summary: 'bad', steps: [{ op: 'delete', id: 'b1' }] }),
    }
    const { controller, engine } = setup(provider)
    await controller.generate('uppercase', [target], 'r1')
    expect(controller.getSnapshot().phase).toBe('error')
    expect(engine.edit).not.toHaveBeenCalled()
  })
  it('preference write failure reports edits applied, not failed or retried', async () => {
    const { controller, settings, engine } = setup()
    await controller.generate('uppercase', [target], 'r1')
    vi.spyOn(settings, 'set').mockRejectedValue(new Error('quota'))
    await controller.accept(true)
    expect(controller.getSnapshot().phase).toBe('done')
    expect(controller.getSnapshot().message).toContain('could not be saved')
    expect(engine.edit).toHaveBeenCalledTimes(1)
  })
  it('settings read failure fails closed instead of silently applying', async () => {
    const { controller, settings, engine } = setup()
    vi.spyOn(settings, 'get').mockRejectedValue(new Error('unavailable'))
    await controller.generate('uppercase', [target], 'r1')
    expect(controller.getSnapshot().phase).toBe('error')
    expect(engine.edit).not.toHaveBeenCalled()
  })
})
