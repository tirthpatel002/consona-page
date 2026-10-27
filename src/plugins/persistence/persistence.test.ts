// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestEditor } from '../../editor/core'
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
})
