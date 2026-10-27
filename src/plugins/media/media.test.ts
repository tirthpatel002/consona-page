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

  it('inserts dropped files as data URLs and turns documents into file blocks and skips unsafe types and oversized files', async () => {
    const { editor, destroy } = make('<p>one</p>')
    const problems: string[] = []
    const png = new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' })
    const text = new File(['hi'], 'a.txt', { type: 'text/plain' })
    const page = new File(['<b>x</b>'], 'a.html', { type: 'text/html' })
    const big = new File([new Uint8Array(MAX_EMBED_BYTES + 1)], 'big.mp4', { type: 'video/mp4' })
    const count = await insertFiles(editor, [png, text, page, big], editor.state.doc.content.size, (m) =>
      problems.push(m),
    )
    expect(count).toBe(2)
    expect(problems).toEqual([expect.stringContaining('big.mp4')])
    const blocks = editor.state.doc.content.content.filter((n) => n.type.name === 'media')
    expect(blocks.map((n) => n.attrs.kind)).toEqual(['image', 'file'])
    expect(String(blocks[0]?.attrs.src)).toMatch(/^data:image\/png;base64,/)
    expect(blocks[1]?.attrs).toMatchObject({ name: 'a.txt', size: 2 })
    destroy()
  })
})

describe('media toolbar', () => {
  it('finds the block from a node selection or the caption caret, and changes alignment as one step', async () => {
    const { mediaToolbar, findSelectedMedia } = await import('./mediaToolbar')
    const { editor, destroy } = make('<p>keep</p>')
    expect(findSelectedMedia(editor)).toBeNull()
    insertMedia.run(editor, 'image', 'https://x.test/a.png')
    const found = findSelectedMedia(editor)
    if (!found) throw new Error('no media selected')
    expect(found.src).toBe('https://x.test/a.png')
    const group = mediaToolbar.groups[0]
    if (group.kind !== 'menus') throw new Error('expected the align menu')
    const left = group.menus[0].sections[0][0]
    left.run(editor)
    expect(editor.state.doc.nodeAt(found.pos)?.attrs.align).toBe('left')
    expect(left.isActive?.(editor)).toBe(true)
    editor.commands.undo()
    expect(editor.state.doc.nodeAt(found.pos)?.attrs.align).toBe('center')
    destroy()
  })

  it('only offers Open original and Download for safe sources, and delete removes the block', async () => {
    const { mediaToolbar } = await import('./mediaToolbar')
    const { editor, destroy } = make('<p>keep</p>')
    insertMedia.run(editor, 'image', 'data:image/png;base64,AAAA')
    const actions = mediaToolbar.groups.flatMap((g) =>
      g.kind === 'menus' ? g.menus.flatMap((m) => m.sections.flat()) : [...g.actions],
    )
    const by = (id: string) => {
      const hit = actions.find((a) => a.id === id)
      if (!hit) throw new Error(id)
      return hit
    }
    expect(by('media:open-original').can(editor)).toBe(false)
    expect(by('media:download').can(editor)).toBe(true)
    by('media:delete').run(editor)
    expect(names(editor)).not.toContain('media')
    destroy()
  })
})

describe('media toolbar on a locked page', () => {
  it('disables every editing action and the run guards hold', async () => {
    const { mediaToolbar } = await import('./mediaToolbar')
    const { editor, destroy } = make('<p>keep</p>')
    insertMedia.run(editor, 'image', 'https://x.test/a.png')
    editor.setEditable(false)
    const before = JSON.stringify(editor.getJSON())
    const actions = mediaToolbar.groups.flatMap((g) =>
      g.kind === 'menus' ? g.menus.flatMap((m) => m.sections.flat()) : [...g.actions],
    )
    const editing = actions.filter((a) => !['media:download', 'media:open-original', 'media:fullscreen'].includes(a.id))
    expect(editing.length).toBeGreaterThan(0)
    for (const action of editing) {
      expect(action.can(editor)).toBe(false)
      action.run(editor)
    }
    expect(JSON.stringify(editor.getJSON())).toBe(before)
    destroy()
  })
})
