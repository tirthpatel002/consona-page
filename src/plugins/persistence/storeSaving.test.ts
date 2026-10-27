// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryStore, createTestEditor, type JsonObject, type PageStore } from '../../editor/core'
import { createPersistencePlugin, type PersistenceSession } from '.'

const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })

describe('saving through a page store', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const make = (store: PageStore, revision: number | null) => {
    const session: PersistenceSession = { store, revision }
    const plugin = createPersistencePlugin(session)
    const { editor, destroy } = createTestEditor({
      plugins: [{ id: 'p', extensions: [StarterKit, ...(plugin.extensions ?? [])] }],
      content: '<p>start</p>',
    })
    const type = (text: string) => editor.commands.insertContentAt(editor.state.doc.content.size - 1, text)
    return { editor, destroy, session, type }
  }

  it('saves, tracks the revision and reports saved', async () => {
    const store = createMemoryStore()
    const { editor, destroy, session, type } = make(store, null)
    type(' one')
    await vi.advanceTimersByTimeAsync(1000)
    expect(editor.storage.docPersistence.status).toBe('saved')
    expect(session.revision).toBe(1)
    type(' two')
    await vi.advanceTimersByTimeAsync(1000)
    expect(session.revision).toBe(2)
    expect(JSON.stringify((await store.get('default'))?.doc)).toContain('one two')
    destroy()
  })

  it('does not overwrite a newer copy: reports a conflict and stops saving', async () => {
    const store = createMemoryStore()
    await store.put('default', doc('from another tab') as JsonObject) // revision 1
    const { editor, destroy, type } = make(store, null) // this tab thinks the page did not exist
    type(' mine')
    await vi.advanceTimersByTimeAsync(1000)
    expect(editor.storage.docPersistence.status).toBe('conflict')
    expect(JSON.stringify((await store.get('default'))?.doc)).toContain('from another tab')
    type(' more')
    await vi.advanceTimersByTimeAsync(1000)
    expect((await store.get('default'))?.revision).toBe(1)
    expect(JSON.stringify((await store.get('default'))?.doc)).not.toContain('mine')
    destroy()
  })

  it('reports a failed write and keeps the unsaved document for the next attempt', async () => {
    const store = createMemoryStore()
    const { editor, destroy, type } = make(store, null)
    const put = vi.spyOn(store, 'put').mockRejectedValueOnce(new Error('quota'))
    type(' lost?')
    await vi.advanceTimersByTimeAsync(1000)
    expect(editor.storage.docPersistence.status).toBe('error')
    editor.storage.docPersistence.retry?.()
    await vi.advanceTimersByTimeAsync(10)
    expect(editor.storage.docPersistence.status).toBe('saved')
    expect(JSON.stringify((await store.get('default'))?.doc)).toContain('lost?')
    put.mockRestore()
    destroy()
  })

  it('queues an edit made while a save is in flight and saves the latest text', async () => {
    const store = createMemoryStore()
    const { destroy, type } = make(store, null)
    type(' first')
    await vi.advanceTimersByTimeAsync(500)
    type(' second')
    await vi.advanceTimersByTimeAsync(2000)
    expect(JSON.stringify((await store.get('default'))?.doc)).toContain('first second')
    destroy()
  })
})
