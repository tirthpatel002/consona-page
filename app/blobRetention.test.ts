// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  createMemoryBlobStore,
  createMemoryRegistryStorage,
  createMemoryStore,
  createPageRegistry,
  createTestEditor,
  findOrphanBlobs,
} from '../src/editor/core'
import { createBlobAdopter } from '../src/plugins/media/adopt'
import { createMediaPlugin } from '../src/plugins/media'
import { textPlugin } from '../src/plugins/text'

const flush = () => new Promise((r) => setTimeout(r, 30))
const bytes = (n: number) => new Blob([new Uint8Array(n)], { type: 'image/png' })

describe('copy a file block out of a page, then delete the source page for good', () => {
  it('keeps the file until the target page owns a copy, then the old one is only an orphan', async () => {
    const pages = createMemoryStore()
    const blobs = createMemoryBlobStore()
    const registry = createPageRegistry({ storage: createMemoryRegistryStorage(), pages, blobs })
    const a = await registry.create({ title: 'A' })
    const b = await registry.create({ title: 'B' })
    const original = await blobs.put(a.id, bytes(5))
    const ref = `blob:${original.id}`

    // Page B shows the pasted block and its body is saved with the reference.
    const { editor, destroy } = createTestEditor({
      plugins: [textPlugin(), createMediaPlugin({ blobs, pageId: () => b.id })],
      content: '<p>x</p>',
    })
    editor.commands.insertContentAt(0, { type: 'media', attrs: { kind: 'image', src: '', blob: ref } })
    await pages.put(b.id, editor.getJSON() as never)

    // The source page is deleted before B's copy exists.
    await registry.moveToTrash(a.id)
    await registry.deleteForever(a.id)
    expect((await blobs.get(original.id))?.blob.size).toBe(5)

    const adopter = createBlobAdopter(
      editor,
      blobs,
      () => b.id,
      () => undefined,
    )
    adopter.scan()
    await flush()
    let newRef = ''
    editor.state.doc.descendants((n) => {
      if (n.type.name === 'media') newRef = String(n.attrs.blob)
    })
    expect(newRef).not.toBe(ref)
    expect((await blobs.get(newRef.slice(5)))?.pageId).toBe(b.id)
    expect((await blobs.get(newRef.slice(5)))?.blob.size).toBe(5)

    // Once B's saved body points at its own copy, the kept original is an orphan a sweep can find.
    await pages.put(b.id, editor.getJSON() as never)
    expect(await findOrphanBlobs(blobs, a.id, [])).toEqual([original.id])
    adopter.destroy()
    destroy()
  })
})
