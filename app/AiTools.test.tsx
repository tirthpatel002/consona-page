// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createMemorySettingsStorage, createSettingsStore } from '../src/editor/core'
import type { EditOutcome, PagesEngine } from '../src/editor/engine'
// eslint-disable-next-line no-restricted-imports -- shared test fixture, not runtime dependency
import { createTestEditor } from '../src/editor/core/testing/createTestEditor'
import { createPageEngine } from '../src/editor/engine'
import { textPlugin } from '../src/plugins/text'
import { AiTools } from './AiTools'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const button = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)
const click = async (text: string) => {
  const found = button(text)
  if (!found) throw new Error(`Missing ${text}`)
  await act(async () => {
    found.focus()
    found.click()
  })
}
const mountApplied = async (undoResult: EditOutcome) => {
  const { editor, destroy } = createTestEditor({ plugins: [textPlugin()], content: '<p>hello</p>' })
  const revision = createPageEngine({ editor }).revision()
  const engine = {
    readCompact: vi.fn().mockResolvedValue({ ok: true, revision, text: 'hello', lines: 1, truncated: false }),
    edit: vi.fn().mockResolvedValue({ ok: true, revision: 'r2', applied: 1, replayed: false }),
    undo: vi.fn().mockResolvedValue(undoResult),
  } as unknown as PagesEngine
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () =>
    root.render(
      <AiTools
        editor={editor}
        pageId="one"
        engine={engine}
        settings={createSettingsStore(createMemorySettingsStorage())}
      />,
    ),
  )
  await click('AI actions')
  await click('Prepare changes')
  expect(document.querySelector('[role=dialog]')?.contains(document.activeElement)).toBe(true)
  await click('Accept')
  expect(document.querySelector('[role=dialog]')?.contains(document.activeElement)).toBe(true)
  expect(document.body.textContent).toContain('Changes applied.')
  return {
    engine,
    cleanup: async () => {
      await act(async () => root.unmount())
      host.remove()
      destroy()
    },
  }
}
describe('AI applied / undone status', () => {
  it('successful Undo replaces applied message, removes Undo, focuses Close', async () => {
    const { engine, cleanup } = await mountApplied({ ok: true, revision: 'r3', applied: 1, replayed: false })
    try {
      await click('Undo changes')
      expect(document.body.textContent).toContain('Changes undone.')
      expect(document.body.textContent).not.toContain('Changes applied.')
      expect(button('Undo changes')).toBeUndefined()
      expect(document.activeElement).toBe(button('Close'))
      expect(engine.undo).toHaveBeenCalledExactlyOnceWith('one')
    } finally {
      await cleanup()
    }
  })
  it('refused Undo preserves applied status and reports refusal, not undone', async () => {
    const { cleanup } = await mountApplied({
      ok: false,
      errors: [{ code: 'changed_since', message: 'The page changed since the edit.' }],
    })
    try {
      await click('Undo changes')
      expect(document.body.textContent).toContain('Changes applied.')
      expect(document.body.textContent).toContain('The page changed since the edit.')
      expect(document.body.textContent).not.toContain('Changes undone.')
      expect(button('Undo changes')).toBeDefined()
    } finally {
      await cleanup()
    }
  })
})
