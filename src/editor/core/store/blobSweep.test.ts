import { describe, expect, it } from 'vitest'
import { createMemoryBlobStore } from './blobStore'
import { findOrphanBlobs, referencedBlobIds, removeBlobs } from './blobSweep'

const file = () => new Blob([new Uint8Array(3)], { type: 'image/png' })
const mediaDoc = (...ids: string[]) => ({
  type: 'doc',
  content: ids.map((id) => ({ type: 'media', attrs: { kind: 'image', blob: `blob:${id}` } })),
})

describe('orphan files', () => {
  it('finds references at any depth and ignores other values', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'columns', content: [{ type: 'media', attrs: { blob: 'blob:abc', src: 'https://x/blob:no' } }] },
      ],
    }
    expect([...referencedBlobIds(doc)]).toEqual(['abc'])
    expect([...referencedBlobIds({ attrs: { blob: 'not-a-ref' } })]).toEqual([])
  })

  it('lists only files no document refers to, counts saved versions, and never touches other pages', async () => {
    const blobs = createMemoryBlobStore()
    const a = await blobs.put('p', file())
    const b = await blobs.put('p', file())
    const c = await blobs.put('p', file())
    const other = await blobs.put('q', file())
    const current = mediaDoc(a.id)
    const version = mediaDoc(b.id)
    expect([...(await findOrphanBlobs(blobs, 'p', [current]))].sort()).toEqual([b.id, c.id].sort())
    expect(await findOrphanBlobs(blobs, 'p', [current, version])).toEqual([c.id])
    expect(await findOrphanBlobs(blobs, 'q', [])).toEqual([other.id])
    expect(await blobs.list('p')).toHaveLength(3)
  })

  it('removes exactly the ids given', async () => {
    const blobs = createMemoryBlobStore()
    const a = await blobs.put('p', file())
    const b = await blobs.put('p', file())
    expect(await removeBlobs(blobs, [a.id])).toBe(1)
    expect((await blobs.list('p')).map((x) => x.id)).toEqual([b.id])
  })
})
