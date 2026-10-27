// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMemoryStore,
  createTestEditor,
  StorageQuotaError,
  UnsupportedFormatError,
  type JsonObject,
  type PageStore,
} from '../../editor/core'
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

  it('a full browser storage says so, keeps the unsaved page, and a retry saves once there is room', async () => {
    const inner = createMemoryStore()
    let full = true
    const store: PageStore = {
      ...inner,
      put: (id, d, o) => (full ? Promise.reject(new StorageQuotaError()) : inner.put(id, d, o)),
    }
    const { editor, destroy, type } = make(store, null)
    type(' big')
    await vi.advanceTimersByTimeAsync(1000)
    expect(editor.storage.docPersistence.status).toBe('error')
    expect(editor.storage.docPersistence.message).toContain('no room')
    full = false
    editor.storage.docPersistence.retry?.()
    await vi.advanceTimersByTimeAsync(10)
    expect(editor.storage.docPersistence.status).toBe('saved')
    expect(JSON.stringify((await inner.get('default'))?.doc)).toContain('big')
    destroy()
  })

  it('a page from a newer version stops saving and tells the user; nothing is written', async () => {
    const inner = createMemoryStore()
    let writes = 0
    const store: PageStore = {
      ...inner,
      put: () => {
        writes += 1
        return Promise.reject(new UnsupportedFormatError('default', 99))
      },
    }
    const { editor, destroy, type } = make(store, null)
    type(' x')
    await vi.advanceTimersByTimeAsync(1000)
    expect(editor.storage.docPersistence.status).toBe('conflict')
    expect(editor.storage.docPersistence.message).toContain('newer version')
    type(' y')
    await vi.advanceTimersByTimeAsync(1000)
    expect(writes).toBe(1)
    destroy()
  })
})

describe('live updates from another tab', () => {
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
  const text = (editor: ReturnType<typeof make>['editor']) => editor.state.doc.textContent

  it("shows another tab's save when nothing is unsaved here, and keeps saving on top of it", async () => {
    const store = createMemoryStore()
    await store.put('default', doc('first') as JsonObject)
    const { editor, destroy, session, type } = make(store, 1)
    await vi.advanceTimersByTimeAsync(1000) // the editor's own first save (block ids) settles first
    const mine = session.revision
    await store.put('default', doc('from tab two') as JsonObject, { expectedRevision: mine })
    await vi.advanceTimersByTimeAsync(10)
    expect(text(editor)).toBe('from tab two')
    expect(session.revision).toBe((mine ?? 0) + 1)
    expect(editor.storage.docPersistence.message).toContain('another tab')
    type(' plus mine')
    await vi.advanceTimersByTimeAsync(1000)
    expect(editor.storage.docPersistence.status).toBe('saved')
    expect(session.revision).toBe((mine ?? 0) + 2)
    expect(JSON.stringify((await store.get('default'))?.doc)).toContain('from tab two plus mine')
    destroy()
  })

  it('does not replace unsaved edits: reports the conflict at once and writes nothing', async () => {
    const store = createMemoryStore()
    await store.put('default', doc('first') as JsonObject)
    const { editor, destroy, session, type } = make(store, 1)
    await vi.advanceTimersByTimeAsync(1000)
    const mine = session.revision
    type(' mine')
    await store.put('default', doc('from tab two') as JsonObject, { expectedRevision: mine })
    await vi.advanceTimersByTimeAsync(1000)
    expect(editor.storage.docPersistence.status).toBe('conflict')
    expect(text(editor)).toContain('mine')
    expect((await store.get('default'))?.revision).toBe((mine ?? 0) + 1)
    expect(JSON.stringify((await store.get('default'))?.doc)).not.toContain('mine')
    destroy()
  })

  it('a removal elsewhere is a conflict, never a silent empty page', async () => {
    const store = createMemoryStore()
    await store.put('default', doc('first') as JsonObject)
    const { editor, destroy } = make(store, 1)
    await store.remove('default')
    await vi.advanceTimersByTimeAsync(10)
    expect(editor.storage.docPersistence.status).toBe('conflict')
    expect(text(editor)).toBe('start')
    destroy()
  })

  it('ignores its own saves', async () => {
    const store = createMemoryStore()
    const { editor, destroy, type } = make(store, null)
    type(' a')
    await vi.advanceTimersByTimeAsync(1000)
    expect(editor.storage.docPersistence.message).toBe('')
    expect(text(editor)).toBe('start a')
    destroy()
  })
})
