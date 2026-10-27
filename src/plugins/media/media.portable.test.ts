// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryBlobStore, createTestEditor, type BlobStore } from '../../editor/core'
import { toHtml } from '../export/html'
import type { Doc } from '../export/types'
import { textPlugin } from '../text'
import { createBlobAdopter } from './adopt'
import { setMediaHost } from './host'
import { createMediaPlugin } from './index'
import { inlineStoredFiles } from './portable'

afterEach(() => setMediaHost({}))

const docWith = (...refs: [string, string][]): Doc => ({
  type: 'doc',
  content: refs.map(([kind, blob]) => ({ type: 'media', attrs: { kind, src: '', blob, name: 'f' } })),
})
const png = (n = 4) => new Blob([new Uint8Array(n)], { type: 'image/png' })

describe('inlineStoredFiles', () => {
  it('inlines readable files, lists the rest with a reason and leaves the input alone', async () => {
    const blobs = createMemoryBlobStore()
    const ok = await blobs.put('p', png())
    const big = await blobs.put('p', png(50))
    const doc = docWith(['image', `blob:${ok.id}`], ['image', `blob:${big.id}`], ['image', 'blob:missing1'])
    const before = JSON.stringify(doc)
    const { doc: out, omitted } = await inlineStoredFiles(doc, blobs, { maxInlineBytes: 10 })
    expect(JSON.stringify(doc)).toBe(before)
    const nodes = out.content ?? []
    expect(String(nodes[0]?.attrs?.src)).toMatch(/^data:image\/png;base64,/)
    expect(nodes[1]?.attrs?.src).toBe('')
    expect(omitted.map((o) => o.ref)).toEqual([`blob:${big.id}`, 'blob:missing1'])
    expect(omitted[0]?.reason).toMatch(/larger/)
    expect(omitted[1]?.reason).toMatch(/missing/)
    expect(toHtml(out)).toContain('data:image/png')
    expect(toHtml(out)).toContain('not included in this export')
  })

  it('treats a failing store as omitted, and no store as omitted', async () => {
    const failing = { get: () => Promise.reject(new Error('boom')) } as unknown as BlobStore
    const doc = docWith(['image', 'blob:abcd1234'])
    expect((await inlineStoredFiles(doc, failing)).omitted[0]?.reason).toMatch(/could not be read/)
    expect((await inlineStoredFiles(doc, undefined)).omitted).toHaveLength(1)
  })

  it('refuses a stored type that is not allowed for the block kind', async () => {
    const blobs = createMemoryBlobStore({
      limits: { maxFileBytes: 1000, maxPageBytes: 10000, allowedTypes: ['*/*', 'image/svg+xml'] },
    })
    const svg = await blobs.put('p', new Blob(['<svg/>'], { type: 'image/svg+xml' }))
    const { omitted } = await inlineStoredFiles(docWith(['image', `blob:${svg.id}`]), blobs)
    expect(omitted[0]?.reason).toMatch(/not allowed/)
  })
})

const flush = () => new Promise((r) => setTimeout(r, 20))
const two = async () => {
  const blobs = createMemoryBlobStore({ limits: { maxFileBytes: 1000 } })
  setMediaHost({ blobs, pageId: () => 'page-b' })
  const plugin = createMediaPlugin({ blobs, pageId: () => 'page-b' })
  const src = await blobs.put('page-a', png())
  const ref = `blob:${src.id}`
  const content = `<p>x</p>`
  const { editor } = createTestEditor({ plugins: [textPlugin(), plugin], content })
  editor.commands.insertContentAt(0, {
    type: 'media',
    attrs: { kind: 'image', src: '', blob: ref, alt: 'keep', name: 'n', caption: true },
  })
  return { blobs, editor, ref, src }
}
const mediaAttrs = (editor: Awaited<ReturnType<typeof two>>['editor']) => {
  const found: Record<string, unknown>[] = []
  editor.state.doc.descendants((n) => {
    if (n.type.name === 'media') found.push(n.attrs)
  })
  return found
}

describe('cross-page adoption', () => {
  it('copies the file to this page, rewrites the ref keeping other attrs, and survives the source page going away', async () => {
    const { blobs, editor, ref } = await two()
    await flush()
    const [attrs] = mediaAttrs(editor)
    expect(attrs?.blob).not.toBe(ref)
    expect(attrs?.name).toBe('n')
    expect(attrs?.alt).toBe('keep')
    const id = String(attrs?.blob).slice(5)
    expect((await blobs.get(id))?.pageId).toBe('page-b')
    await blobs.removePage('page-a')
    expect(await blobs.get(id)).not.toBeNull()
    // The follow-up change is not an undo step: undo never brings the other page's ref back.
    editor.commands.undo()
    expect(mediaAttrs(editor).some((a) => a.blob === ref)).toBe(false)
  })

  it('keeps the original ref and warns once when the copy cannot be saved', async () => {
    const real = createMemoryBlobStore({ limits: { maxFileBytes: 1000 } })
    const blobs: BlobStore = {
      ...real,
      put: (page, blob, o) => (page === 'page-a' ? real.put(page, blob, o) : Promise.reject(new Error('quota'))),
    }
    const src = await blobs.put('page-a', png(1))
    const ref = `blob:${src.id}`
    const { editor } = createTestEditor({
      plugins: [textPlugin(), createMediaPlugin({ blobs, pageId: () => 'page-b' })],
      content: '<p>x</p>',
    })
    const warnings: string[] = []
    const adopter = createBlobAdopter(
      editor,
      blobs,
      () => 'page-b',
      (m) => warnings.push(m),
    )
    editor.commands.insertContentAt(0, { type: 'media', attrs: { kind: 'image', src: '', blob: ref } })
    adopter.scan()
    await flush()
    adopter.scan()
    await flush()
    expect(mediaAttrs(editor)[0]?.blob).toBe(ref)
    expect(warnings).toHaveLength(1)
    expect((await blobs.get(src.id))?.pageId).toBe('page-a')
    adopter.destroy()
  })

  it('does not copy again for a file that already belongs to this page, and cleans up if the block was deleted meanwhile', async () => {
    const blobs = createMemoryBlobStore({ limits: { maxFileBytes: 1000 } })
    const mine = await blobs.put('page-b', png())
    const other = await blobs.put('page-a', png())
    const { editor } = createTestEditor({
      plugins: [textPlugin(), createMediaPlugin({ blobs, pageId: () => 'page-b' })],
      content: '<p>x</p>',
    })
    editor.commands.insertContentAt(0, { type: 'media', attrs: { kind: 'image', src: '', blob: `blob:${mine.id}` } })
    await flush()
    expect((await blobs.list('page-b')).length).toBe(1)
    editor.commands.insertContentAt(0, { type: 'media', attrs: { kind: 'image', src: '', blob: `blob:${other.id}` } })
    editor.commands.deleteRange({ from: 0, to: 1 })
    await flush()
    expect((await blobs.list('page-b')).length).toBe(1)
  })
})
