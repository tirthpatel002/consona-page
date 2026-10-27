// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemorySettingsStorage, createSettingsStore } from '../src/editor/core'
import { PageSettingsModal } from './PageSettingsModal'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | null = null
let host: HTMLDivElement | null = null
afterEach(async () => {
  await act(async () => root?.unmount())
  host?.remove()
  root = null
  document.body.innerHTML = ''
})
const mount = async (ui: React.ReactNode) => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => {
    root?.render(ui)
  })
}
const button = (text: string) => {
  const found = [...document.querySelectorAll('button')].find((b) => b.textContent === text)
  if (!found) throw new Error(`Missing ${text}`)
  return found
}
describe('Page Settings modal', () => {
  it('can restore review without writing the lock, and saves only the current page', async () => {
    const settings = createSettingsStore(createMemorySettingsStorage())
    await settings.set('one', { locked: true, aiReview: 'apply' })
    const spy = vi.spyOn(settings, 'set')
    const close = vi.fn()
    await mount(<PageSettingsModal pageId="one" settings={settings} close={close} />)
    expect(document.body.textContent).toContain('Page lock: Locked')
    const input = document.querySelector('input') as HTMLInputElement
    expect(input.checked).toBe(false)
    await act(async () => input.click())
    await act(async () => button('Save settings').click())
    expect(spy).toHaveBeenCalledWith('one', { aiReview: 'ask' })
    expect((await settings.get('one')).locked).toBe(true)
    expect((await settings.get('two')).aiReview).toBe('ask')
    expect(close).toHaveBeenCalledOnce()
  })
  it('shows failed save and leaves modal open', async () => {
    const settings = createSettingsStore(createMemorySettingsStorage())
    vi.spyOn(settings, 'set').mockRejectedValue(new Error('quota'))
    const close = vi.fn()
    await mount(<PageSettingsModal pageId="one" settings={settings} close={close} />)
    await act(async () => button('Save settings').click())
    expect(document.querySelector('[role=alert]')?.textContent).toContain('Could not save')
    expect(close).not.toHaveBeenCalled()
  })
  it('failed read offers Retry, never a default-setting write', async () => {
    const settings = createSettingsStore(createMemorySettingsStorage())
    vi.spyOn(settings, 'get').mockRejectedValueOnce(new Error('read failed'))
    const set = vi.spyOn(settings, 'set')
    await mount(<PageSettingsModal pageId="one" settings={settings} close={() => undefined} />)
    expect(document.querySelector('[role=alert]')?.textContent).toContain('Could not read')
    expect(set).not.toHaveBeenCalled()
    await act(async () => button('Retry').click())
    expect(document.querySelector('input')).not.toBeNull()
  })
  it('traps backwards Tab and restores focus on unmount', async () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    await mount(
      <PageSettingsModal
        pageId="one"
        settings={createSettingsStore(createMemorySettingsStorage())}
        close={() => undefined}
      />,
    )
    const dialog = document.querySelector('[role=dialog]') as HTMLElement
    expect(document.activeElement).toBe(dialog)
    await act(async () =>
      dialog.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
      ),
    )
    expect(document.activeElement).toBe(button('Save settings'))
    await act(async () => root?.unmount())
    root = null
    expect(document.activeElement).toBe(trigger)
  })
})
