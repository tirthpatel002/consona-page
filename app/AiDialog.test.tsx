// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { AiDialog } from './AiDialog'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
describe('AI dialog focus across view transitions', () => {
  it('repairs removed and disabled action focus, keeps surviving focus, and restores trigger on Escape close', async () => {
    const host = document.createElement('div'),
      trigger = document.createElement('button')
    document.body.append(trigger, host)
    trigger.focus()
    const root = createRoot(host)
    const close = vi.fn()
    const view = async (phase: string, busy = false) => {
      await act(async () =>
        root.render(
          <AiDialog title="AI actions" close={close} busy={busy}>
            <button key={phase} type="button">
              {phase}
            </button>
          </AiDialog>,
        ),
      )
    }
    try {
      await view('Prepare changes')
      const dialog = document.querySelector('[role=dialog]') as HTMLElement
      const focusAction = () => {
        const control = [...dialog.querySelectorAll('button')].at(-1)
        control?.focus()
      }
      for (const phase of [
        'Preparing changes',
        'Accept',
        'Applying changes',
        'Changes applied',
        'Changes undone',
        'Error',
      ]) {
        focusAction()
        await view(phase, phase === 'Applying changes')
        expect(document.activeElement).toBe(dialog)
        expect(dialog.contains(document.activeElement)).toBe(true)
      }
      focusAction()
      const kept = document.activeElement
      await view('Error')
      expect(document.activeElement).toBe(kept)
      const closeButton = dialog.querySelector('button') as HTMLButtonElement
      closeButton.focus()
      await view('Applying changes', true)
      expect(document.activeElement).toBe(dialog)
      await view('Directly applied')
      focusAction()
      await act(async () =>
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
      )
      expect(close).toHaveBeenCalledOnce()
      await act(async () => root.render(null))
      expect(document.activeElement).toBe(trigger)
    } finally {
      await act(async () => root.unmount())
      host.remove()
      trigger.remove()
    }
  })
})
