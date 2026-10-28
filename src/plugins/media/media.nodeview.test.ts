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

  it('keeps the same audio element when attrs that do not change the frame shell update', () => {
    const plugin = createMediaPlugin({})
    const { editor, destroy } = createTestEditor({
      plugins: [textPlugin(), plugin],
      content: {
        type: 'doc',
        content: [{ type: 'media', attrs: { kind: 'audio', src: 'https://x.test/a.mp3', align: 'center' } }],
      },
    })
    const audio = editor.view.dom.querySelector('figure.page-media audio')
    expect(audio).toBeTruthy()
    expect(editor.view.dom.querySelector('.page-media__audio-ui')).toBeTruthy()
    expect(audio?.hasAttribute('controls')).toBe(false)
    expect(editor.view.dom.querySelector('.page-media__seek')).toBeTruthy()
    editor
      .chain()
      .command(({ tr, state, dispatch }) => {
        const pos = 0
        const node = state.doc.nodeAt(pos)
        if (!node || !dispatch) return false
        dispatch(tr.setNodeMarkup(pos, undefined, { ...node.attrs, align: 'left', showCaption: false }))
        return true
      })
      .run()
    expect(editor.view.dom.querySelector('figure.page-media audio')).toBe(audio)
    destroy()
  })

  it('uses a custom video bar with a seek control and no native controls', () => {
    const plugin = createMediaPlugin({})
    const { editor, destroy } = createTestEditor({
      plugins: [textPlugin(), plugin],
      content: {
        type: 'doc',
        content: [{ type: 'media', attrs: { kind: 'video', src: 'https://x.test/a.mp4' } }],
      },
    })
    const video = editor.view.dom.querySelector('figure.page-media video')
    expect(video?.hasAttribute('controls')).toBe(false)
    expect(editor.view.dom.querySelector('.page-media__video-ui .page-media__seek')).toBeTruthy()
    destroy()
  })
})
