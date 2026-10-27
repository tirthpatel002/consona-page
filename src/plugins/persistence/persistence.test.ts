// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestEditor, restoreVersion, VersionStore } from '../../editor/core'
import { loadPersistedDoc, persistencePlugin, resetPersistedDoc } from '.'

describe('document persistence (demo)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  it('saves the edited document under the stable id and loads it back', async () => {
    const { editor, destroy } = createTestEditor({
      plugins: [{ id: 'persistence', extensions: [StarterKit, ...(persistencePlugin.extensions ?? [])] }],
      content: '<p>original</p>',
    })
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.insertContent(' edited')
    await vi.advanceTimersByTimeAsync(1000)
    const saved = loadPersistedDoc('default')
    expect(JSON.stringify(saved)).toContain('edited')
    destroy()
  })

  it('falls back to the sample when storage holds garbage', () => {
    localStorage.setItem('page:doc:default', '{not json')
    expect(loadPersistedDoc('default')).toBeNull()
    localStorage.setItem('page:doc:default', JSON.stringify({ type: 'not-doc' }))
    expect(loadPersistedDoc('default')).toBeNull()
  })

  it('reset clears only the current document key and preserves other documents', () => {
    localStorage.setItem('page:doc:a', JSON.stringify({ type: 'doc', content: [] }))
    localStorage.setItem('page:doc:b', JSON.stringify({ type: 'doc', content: [] }))
    resetPersistedDoc('a')
    expect(localStorage.getItem('page:doc:a')).toBeNull()
    expect(localStorage.getItem('page:doc:b')).not.toBeNull()
  })

  it('scopes storage to the document identity extension', async () => {
    const { editor, destroy } = createTestEditor({
      plugins: [{ id: 'persistence', extensions: [StarterKit, ...(persistencePlugin.extensions ?? [])] }],
      content: '<p>scoped</p>',
    })
    // simulate a PageEditor-configured identity
    editor.storage.documentIdentity = { documentId: 'doc-xyz' }
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' here')
    await vi.advanceTimersByTimeAsync(1000)
    expect(loadPersistedDoc('doc-xyz')).not.toBeNull()
    expect(loadPersistedDoc('default')).toBeNull()
    destroy()
  })

  it('saves a restored version, so a reload keeps it', async () => {
    const { editor, destroy } = createTestEditor({
      plugins: [{ id: 'persistence', extensions: [StarterKit, ...(persistencePlugin.extensions ?? [])] }],
      content: '<p>newer text</p>',
    })
    const older = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'older text' }] }] }
    expect(restoreVersion.run(editor, older)).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(JSON.stringify(loadPersistedDoc('default'))).toContain('older text')
    expect(JSON.stringify(loadPersistedDoc('default'))).not.toContain('newer text')
    destroy()
  })

  it('keeps a version restored from history after a reload', async () => {
    const { editor, destroy } = createTestEditor({
      plugins: [{ id: 'persistence', extensions: [StarterKit, ...(persistencePlugin.extensions ?? [])] }],
      content: '<p>start</p>',
    })
    const store = new VersionStore(editor, { storageKey: 'test:versions:restore' })
    editor.commands.setContent('<p>old body</p>', { emitUpdate: true })
    const old = store.snapshot('manual', 'Old')
    editor.commands.setContent('<p>new body</p>', { emitUpdate: true })
    await vi.advanceTimersByTimeAsync(1000)
    expect(JSON.stringify(loadPersistedDoc('default'))).toContain('new body')
    expect(old).not.toBeNull()
    if (!old) return
    expect(store.restoreSaved(old.id)).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(JSON.stringify(loadPersistedDoc('default'))).toContain('old body')
    expect(JSON.stringify(loadPersistedDoc('default'))).not.toContain('new body')
    store.destroy()
    destroy()
  })

  it('writes a pending edit when the page is hidden, before the debounce fires', () => {
    const { editor, destroy } = createTestEditor({
      plugins: [{ id: 'persistence', extensions: [StarterKit, ...(persistencePlugin.extensions ?? [])] }],
      content: '<p>original</p>',
    })
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' last words')
    expect(loadPersistedDoc('default')).toBeNull()
    window.dispatchEvent(new Event('pagehide'))
    expect(JSON.stringify(loadPersistedDoc('default'))).toContain('last words')
    destroy()
  })

  it('writes a pending edit when the editor is destroyed', () => {
    const { editor, destroy } = createTestEditor({
      plugins: [{ id: 'persistence', extensions: [StarterKit, ...(persistencePlugin.extensions ?? [])] }],
      content: '<p>original</p>',
    })
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' before unmount')
    destroy()
    expect(JSON.stringify(loadPersistedDoc('default'))).toContain('before unmount')
  })

  it('reports a failed save and clears the report once a save works', async () => {
    const { editor, destroy } = createTestEditor({
      plugins: [{ id: 'persistence', extensions: [StarterKit, ...(persistencePlugin.extensions ?? [])] }],
      content: '<p>original</p>',
    })
    const failing = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' one')
    await vi.advanceTimersByTimeAsync(1000)
    expect(editor.storage.docPersistence.degraded).toBe(true)
    failing.mockRestore()
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' two')
    await vi.advanceTimersByTimeAsync(1000)
    expect(editor.storage.docPersistence.degraded).toBe(false)
    destroy()
  })
})
