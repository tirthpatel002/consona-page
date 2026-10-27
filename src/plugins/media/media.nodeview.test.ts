// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryBlobStore, createTestEditor } from '../../editor/core'
import { textPlugin } from '../text'
import { setMediaHost } from './host'
import { createMediaPlugin } from './index'

afterEach(() => {
  setMediaHost({})
  vi.restoreAllMocks()
})

describe('media node view with a stored file', () => {
  it('shows the file and settles: swapping the object URL does not make a document change loop', async () => {
    const blobs = createMemoryBlobStore()
    const saved = await blobs.put('page-1', new Blob([new Uint8Array(4)], { type: 'image/png' }))
    Object.assign(URL, { createObjectURL: () => 'blob:test/1', revokeObjectURL: () => undefined })
    const plugin = createMediaPlugin({ blobs, pageId: () => 'page-1' })
    const { editor, destroy } = createTestEditor({
      plugins: [textPlugin(), plugin],
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'keep' }] },
          { type: 'media', attrs: { kind: 'image', blob: `blob:${saved.id}` } },
        ],
      },
    })
    let transactions = 0
    editor.on('transaction', () => (transactions += 1))
    await new Promise((resolve) => setTimeout(resolve, 300))
    const img = editor.view.dom.querySelector('figure.page-media img')
    expect(img?.getAttribute('src')).toBe('blob:test/1')
    // a few settling transactions are fine; a loop would run into the hundreds in 300 ms
    expect(transactions).toBeLessThan(10)
    destroy()
  })
})
