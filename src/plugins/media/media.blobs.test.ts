// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryBlobStore, createTestEditor } from '../../editor/core'
import { toHtml } from '../export/html'
import { toMarkdown } from '../export/markdown'
import { sanitizeImported } from '../export/safeUrls'
import type { Doc } from '../export/types'
import { textPlugin } from '../text'
import { importFile } from './files'
import { acquireBlobUrl, isBlobRef, releaseBlobUrl, setMediaHost } from './host'
import { createMediaPlugin } from './index'
import { insertMedia, setMediaDetails, setMediaLayout, setMediaSource } from './operations'

const png = (bytes = 4) => new File([new Uint8Array(bytes)], 'a.png', { type: 'image/png' })

afterEach(() => {
  setMediaHost({})
  vi.restoreAllMocks()
})

const setup = (maxFileBytes = 1024) => {
  const blobs = createMemoryBlobStore({ limits: { maxFileBytes } })
  const plugin = createMediaPlugin({ blobs, pageId: () => 'page-1' })
  const { editor } = createTestEditor({ plugins: [textPlugin(), plugin], content: '<p>keep</p>' })
  return { blobs, editor }
}
const media = (editor: ReturnType<typeof setup>['editor']) => {
  let found: { attrs: Record<string, unknown>; pos: number } | null = null
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'media') found = { attrs: node.attrs, pos }
  })
  if (!found) throw new Error('no media')
  return found as { attrs: Record<string, unknown>; pos: number }
}

describe('media with an injected file store', () => {
  it('falls back to inline data URLs without a store', async () => {
    const r = await importFile(png())
    expect(r.ok && r.src.startsWith('data:image/png')).toBe(true)
  })
  it('stores the file, keeps only a blob reference and survives edits', async () => {
    const { blobs, editor } = setup()
    const result = await importFile(png())
    expect(result.ok && result.src === '' && isBlobRef(result.blob)).toBe(true)
    if (!result.ok || !result.blob) return
    expect(await blobs.list('page-1')).toHaveLength(1)
    expect(insertMedia.run(editor, 'image', '', undefined, { blob: result.blob })).toBe(true)
    const pos = media(editor).pos
    editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'commentThread', 't1'))
    setMediaDetails.run(editor, pos, { alt: 'x' })
    setMediaLayout.run(editor, pos, { width: 200 })
    expect(media(editor).attrs.blob).toBe(result.blob)
    expect(media(editor).attrs.src).toBe('')
  })

  it('refuses an over-limit file, names the limit and stores nothing', async () => {
    const { blobs } = setup(2)
    const result = await importFile(png(10))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/limit/i)
    expect(await blobs.list('page-1')).toHaveLength(0)
  })

  it('rejects a bad reference and clears the blob when the source is replaced by a link', async () => {
    const { editor } = setup()
    expect(insertMedia.run(editor, 'image', '', undefined, { blob: 'blob:../../x' })).toBe(false)
    expect(insertMedia.run(editor, 'image', '', undefined, { blob: 'https://evil.test/a.png' })).toBe(false)
    expect(insertMedia.run(editor, 'bookmark', '', undefined, { blob: 'blob:abcd1234' })).toBe(false)
    const r = await importFile(png())
    if (!r.ok || !r.blob) throw new Error('store failed')
    insertMedia.run(editor, 'image', '', undefined, { blob: r.blob })
    setMediaSource.run(editor, media(editor).pos, 'https://example.com/a.png', 'image')
    expect(media(editor).attrs.blob).toBe('')
  })

  it('hands out one object URL per file and revokes it after the last release', async () => {
    const { blobs } = setup()
    const r = await importFile(png())
    if (!r.ok || !r.blob) throw new Error('store failed')
    const made: string[] = []
    const revoked: string[] = []
    const original = { c: URL.createObjectURL, r: URL.revokeObjectURL }
    Object.assign(URL, {
      createObjectURL: () => {
        const u = `blob:test/${made.length}`
        made.push(u)
        return u
      },
      revokeObjectURL: (u: string) => void revoked.push(u),
    })
    const a = await acquireBlobUrl(r.blob)
    const b = await acquireBlobUrl(r.blob)
    expect(a).toBe(b)
    releaseBlobUrl(r.blob)
    await Promise.resolve()
    expect(revoked).toHaveLength(0)
    releaseBlobUrl(r.blob)
    await new Promise((res) => setTimeout(res, 0))
    Object.assign(URL, { createObjectURL: original.c, revokeObjectURL: original.r })
    expect(revoked).toEqual(made)
    expect(blobs.limits.maxFileBytes).toBeGreaterThan(0)
  })

  it('exports an honest placeholder and imports never keep file references', async () => {
    const { editor } = setup()
    const r = await importFile(png())
    if (!r.ok || !r.blob) throw new Error('store failed')
    insertMedia.run(editor, 'image', '', undefined, { blob: r.blob, name: 'photo.png' })
    const doc = editor.getJSON() as unknown as Doc
    expect(toHtml(doc)).toContain('not included in this export')
    expect(toHtml(doc)).not.toContain('blob:')
    expect(toMarkdown(doc)).toContain('not included in this export')
    const cleaned = JSON.stringify(sanitizeImported(doc))
    expect(cleaned).not.toContain('"blob":"blob:')
  })
})
