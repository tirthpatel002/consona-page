// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { mediaPlugin } from '.'
import { insertFiles } from './behavior'
import { kindOfFile, kindOfUrl, MAX_EMBED_BYTES } from './files'
import { insertMedia, setMediaLayout, setMediaSource } from './operations'

const make = (content = '<p></p>') =>
  createTestEditor({ plugins: [{ id: 'text', extensions: [StarterKit] }, mediaPlugin], content })
const names = (e: ReturnType<typeof make>['editor']) => e.state.doc.content.content.map((n) => n.type.name)
const json = (e: ReturnType<typeof make>['editor']) => {
  const doc = e.getJSON()
  const content = [...(doc.content ?? [])]
  const last = content[content.length - 1]
  if (last?.type === 'paragraph' && !last.content) content.pop()
  return { ...doc, content }
}

describe('media plugin', () => {
  it('recognises media URLs and files', () => {
    expect(kindOfUrl('https://x.test/a.PNG?w=1')).toBe('image')
    expect(kindOfUrl('https://x.test/a.mp4')).toBe('video')
    expect(kindOfUrl('https://x.test/page')).toBeNull()
    expect(kindOfUrl('see https://x.test/a.png')).toBeNull()
    expect(kindOfFile({ type: 'image/png' })).toBe('image')
    expect(kindOfFile({ type: 'application/pdf' })).toBeNull()
  })

  it('inserts after a node-selected media block instead of failing', () => {
    const { editor, destroy } = make('<p>keep</p>')
    editor.commands.setTextSelection(2)
    insertMedia.run(editor, 'image', 'https://x.test/a.png')
    expect(insertMedia.run(editor, 'video', 'https://x.test/v.mp4')).toBe(true)
    expect(names(editor).slice(0, 3)).toEqual(['paragraph', 'media', 'media'])
    destroy()
  })

  it('replaces an empty paragraph, or goes after a non-empty block, and undoes as one step', () => {
    const empty = make()
    expect(insertMedia.run(empty.editor, 'image', 'https://x.test/a.png')).toBe(true)
    expect(names(empty.editor).slice(0, 1)).toEqual(['media'])
    empty.destroy()
    const { editor, destroy } = make('<p>keep</p>')
    const before = json(editor)
    editor.commands.setTextSelection(2)
    insertMedia.run(editor, 'video', 'data:video/mp4;base64,AAAA')
    expect(names(editor).slice(0, 2)).toEqual(['paragraph', 'media'])
    editor.commands.undo()
    expect(json(editor)).toEqual(before)
    destroy()
  })

  it('stores width, alignment and source as separate undo steps and refuses no-ops', () => {
    const { editor, destroy } = make()
    insertMedia.run(editor, 'image', 'https://x.test/a.png')
    const afterInsert = json(editor)
    expect(setMediaLayout.run(editor, 0, { align: 'center' })).toBe(false)
    expect(setMediaLayout.run(editor, 0, { width: 320.4 })).toBe(true)
    expect(setMediaLayout.run(editor, 0, { align: 'right' })).toBe(true)
    expect(editor.getHTML()).toContain('data-align="right"')
    expect(editor.getHTML()).toContain('width: 320px')
    expect(setMediaSource.run(editor, 0, 'https://x.test/b.png')).toBe(true)
    editor.commands.undo()
    editor.commands.undo()
    editor.commands.undo()
    expect(json(editor)).toEqual(afterInsert)
    destroy()
  })

  it('keeps the caption and round-trips through HTML', () => {
    const { editor, destroy } = make()
    insertMedia.run(editor, 'image', 'https://x.test/a.png')
    setMediaLayout.run(editor, 0, { width: 200, align: 'left' })
    editor.commands.insertContentAt(1, 'A cat')
    const html = editor.getHTML()
    expect(html).toContain('<figcaption class="page-media__caption">A cat</figcaption>')
    editor.commands.setContent(html)
    const media = editor.state.doc.firstChild
    expect(media?.type.name).toBe('media')
    expect(media?.textContent).toBe('A cat')
    expect(media?.attrs).toMatchObject({ kind: 'image', src: 'https://x.test/a.png', width: 200, align: 'left' })
    destroy()
  })

  it('inserts dropped files as data URLs and skips non-media and oversized files', async () => {
    const { editor, destroy } = make('<p>one</p>')
    const problems: string[] = []
    const png = new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' })
    const text = new File(['hi'], 'a.txt', { type: 'text/plain' })
    const big = new File([new Uint8Array(MAX_EMBED_BYTES + 1)], 'big.mp4', { type: 'video/mp4' })
    const count = await insertFiles(editor, [png, text, big], editor.state.doc.content.size, (m) => problems.push(m))
    expect(count).toBe(1)
    expect(problems).toEqual([expect.stringContaining('big.mp4')])
    const media = editor.state.doc.content.content.find((n) => n.type.name === 'media')
    expect(String(media?.attrs.src)).toMatch(/^data:image\/png;base64,/)
    destroy()
  })
})
