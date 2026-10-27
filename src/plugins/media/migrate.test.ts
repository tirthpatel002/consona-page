import { describe, expect, it } from 'vitest'
import { createMemoryBlobStore, type JsonObject } from '../../editor/core'
import { migrateInlineMedia } from './migrate'

const png = 'data:image/png;base64,AAECAw=='
const media = (attrs: Record<string, unknown>) => ({ type: 'media', attrs: { kind: 'image', ...attrs } })
const doc = (...content: object[]) => ({ type: 'doc', content }) as unknown as JsonObject
const attrsAt = (d: JsonObject, i: number) =>
  ((d.content as { attrs: Record<string, unknown> }[])[i] as { attrs: Record<string, unknown> }).attrs

describe('migrateInlineMedia', () => {
  it('moves inline data URLs into the store and leaves everything else alone; the input is untouched', async () => {
    const blobs = createMemoryBlobStore()
    const input = doc(
      media({ src: png }),
      media({ src: 'https://x.test/a.png' }),
      media({ kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/abcdefghijk' }),
      media({ kind: 'audio', src: 'data:audio/mpeg;base64,AAECAw==' }),
    )
    const before = JSON.stringify(input)
    const r = await migrateInlineMedia(input, blobs, 'p')
    expect(JSON.stringify(input)).toBe(before)
    expect(r.migrated).toBe(2)
    expect(r.kept).toEqual([])
    expect(attrsAt(r.doc, 0).src).toBe('')
    expect(String(attrsAt(r.doc, 0).blob)).toMatch(/^blob:/)
    expect(attrsAt(r.doc, 1).src).toBe('https://x.test/a.png')
    expect(attrsAt(r.doc, 2).blob).toBeUndefined()
    const stored = await blobs.get(String(attrsAt(r.doc, 0).blob).slice(5))
    expect(stored?.blob.type).toBe('image/png')
    expect(stored?.blob.size).toBe(4)
    expect(stored?.pageId).toBe('p')
  })

  it('is idempotent, and keeps blocks the store refuses or whose data cannot be read, saying why', async () => {
    const blobs = createMemoryBlobStore({ limits: { maxFileBytes: 3 } })
    const input = doc(media({ src: png }), media({ src: 'data:image/png;base64,@@@@' }))
    const r = await migrateInlineMedia(input, blobs, 'p')
    expect(r.migrated).toBe(0)
    expect(r.kept.map((k) => k.reason)).toEqual(['limit', 'unreadable'])
    expect(r.kept[0]?.path).toEqual([0])
    expect(attrsAt(r.doc, 0).src).toBe(png)
    const roomy = createMemoryBlobStore()
    const first = await migrateInlineMedia(input, roomy, 'p')
    const second = await migrateInlineMedia(first.doc, roomy, 'p')
    expect(first.migrated).toBe(1)
    expect(second.migrated).toBe(0)
    expect(await roomy.list('p')).toHaveLength(1)
  })

  it('keeps earlier blocks migrated and later ones inline when the store fails part way', async () => {
    const real = createMemoryBlobStore()
    let calls = 0
    const flaky = {
      ...real,
      put: (...args: Parameters<typeof real.put>) =>
        ++calls > 1 ? Promise.reject(new Error('disk')) : real.put(...args),
    }
    const r = await migrateInlineMedia(doc(media({ src: png }), media({ src: png })), flaky, 'p')
    expect(r.migrated).toBe(1)
    expect(r.kept).toEqual([{ path: [1], reason: 'store_failed' }])
    expect(attrsAt(r.doc, 1).src).toBe(png)
  })
})
