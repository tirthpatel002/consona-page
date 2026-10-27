// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  createMemoryRegistryStorage,
  createMemorySettingsStorage,
  createMemoryStore,
  createPageRegistry,
  createSettingsStore,
  createTestEditor,
  type JsonObject,
} from '../src/editor/core'
import { createMemoryRequestLog } from '../src/editor/engine'
import { createDemoPagesEngine, detachedPlugins } from './pagesEngine'

const setup = () => {
  const store = createMemoryStore()
  const registry = createPageRegistry({ storage: createMemoryRegistryStorage(), pages: store })
  const settings = createSettingsStore(createMemorySettingsStorage())
  const requestLog = createMemoryRequestLog()
  const engine = createDemoPagesEngine({ registry, store, settings, requestLog })
  return { store, registry, settings, requestLog, engine }
}
const ids = (compact: string) => [...compact.matchAll(/^\s*\[([^\]]+)\]/gm)].map((m) => m[1] as string)

describe('pages engine on closed pages', () => {
  it('creates a page from Markdown, reads it compactly and edits it on the stored copy', async () => {
    const { engine, store } = setup()
    const made = await engine.create({ title: 'Notes', text: '## Plan\n\nfirst item\n\nsecond item' })
    expect(made.ok).toBe(true)
    if (!made.ok) return
    const read = await engine.readCompact(made.id)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.text).toMatch(/## Plan/)
    expect(read.text).not.toMatch(/\[[^\]]+\] \n/) // no leftover empty first paragraph
    const [, first] = ids(read.text)
    const edit = await engine.edit(made.id, {
      baseRevision: read.revision,
      requestId: 'r1',
      steps: [{ op: 'replaceMarkdown', id: first as string, text: 'first **item** edited' }],
    })
    expect(edit.ok).toBe(true)
    expect(JSON.stringify((await store.get(made.id))?.doc)).toContain('edited')
    expect((await store.get(made.id))?.revision).toBe(2)
  })

  it('replays a request after the handle is gone (persisted log) and writes nothing twice', async () => {
    const { engine, store } = setup()
    const made = await engine.create({ text: 'a\n\nb' })
    if (!made.ok) throw new Error('create')
    const read = await engine.readCompact(made.id)
    if (!read.ok) throw new Error('read')
    const target = ids(read.text)[0] as string
    const request = {
      baseRevision: read.revision,
      requestId: 'same',
      steps: [{ op: 'replaceMarkdown' as const, id: target, text: 'changed' }],
    }
    const one = await engine.edit(made.id, request)
    const two = await engine.edit(made.id, request)
    expect(one.ok && two.ok).toBe(true)
    if (two.ok) expect(two.replayed).toBe(true)
    expect((await store.get(made.id))?.revision).toBe(2)
  })

  it('refuses a locked page, a trashed page and an unknown page, writing nothing', async () => {
    const { engine, store, settings, registry } = setup()
    const made = await engine.create({ text: 'a' })
    if (!made.ok) throw new Error('create')
    const read = await engine.readCompact(made.id)
    if (!read.ok) throw new Error('read')
    const req = (requestId: string) => ({
      baseRevision: read.revision,
      requestId,
      steps: [{ op: 'replaceMarkdown' as const, id: ids(read.text)[0] as string, text: 'x' }],
    })
    await settings.set(made.id, { locked: true })
    let r = await engine.edit(made.id, req('l'))
    expect(!r.ok && r.errors[0]?.code).toBe('locked')
    await settings.set(made.id, { locked: false })
    await registry.moveToTrash(made.id)
    r = await engine.edit(made.id, req('t'))
    expect(!r.ok && r.errors[0]?.code).toBe('trashed')
    r = await engine.edit('nope', req('u'))
    expect(!r.ok && r.errors[0]?.code).toBe('unknown_page')
    expect((await store.get(made.id))?.revision).toBe(1)
  })

  it('reports a conflict when the page was saved elsewhere meanwhile, and keeps the other copy', async () => {
    const { engine, store } = setup()
    const made = await engine.create({ text: 'a' })
    if (!made.ok) throw new Error('create')
    const read = await engine.readCompact(made.id)
    if (!read.ok) throw new Error('read')
    // another tab saves between the engine's read of the stored body and its write
    const realGet = store.get.bind(store)
    store.get = async (id) => {
      const page = await realGet(id)
      await store.put(id, { ...(page?.doc as JsonObject) } as JsonObject)
      return page
    }
    const r = await engine.edit(made.id, {
      baseRevision: read.revision,
      requestId: 'c',
      steps: [{ op: 'replaceMarkdown', id: ids(read.text)[0] as string, text: 'mine' }],
    })
    expect(!r.ok && r.errors[0]?.code).toBe('conflict')
    expect(JSON.stringify((await realGet(made.id))?.doc)).not.toContain('mine')
  })

  it('a failed store write changes nothing and says so', async () => {
    const { engine, store } = setup()
    const made = await engine.create({ text: 'a' })
    if (!made.ok) throw new Error('create')
    const read = await engine.readCompact(made.id)
    if (!read.ok) throw new Error('read')
    const realPut = store.put.bind(store)
    store.put = () => Promise.reject(new Error('disk full'))
    const r = await engine.edit(made.id, {
      baseRevision: read.revision,
      requestId: 'f',
      steps: [{ op: 'replaceMarkdown', id: ids(read.text)[0] as string, text: 'lost' }],
    })
    expect(!r.ok && r.errors[0]?.code).toBe('store_failed')
    store.put = realPut
    expect(JSON.stringify((await store.get(made.id))?.doc)).not.toContain('lost')
    // not remembered as done, so a retry runs for real
    const retry = await engine.edit(made.id, {
      baseRevision: read.revision,
      requestId: 'f',
      steps: [{ op: 'replaceMarkdown', id: ids(read.text)[0] as string, text: 'kept' }],
    })
    expect(retry.ok).toBe(true)
  })

  it('undoes a closed-page batch, and refuses when the page changed after it', async () => {
    const { engine, store } = setup()
    const made = await engine.create({ text: 'a\n\nb' })
    if (!made.ok) throw new Error('create')
    const read = await engine.readCompact(made.id)
    if (!read.ok) throw new Error('read')
    const original = JSON.stringify((await store.get(made.id))?.doc)
    await engine.edit(made.id, {
      baseRevision: read.revision,
      requestId: 'u',
      steps: [{ op: 'replaceMarkdown', id: ids(read.text)[0] as string, text: 'z' }],
    })
    const undone = await engine.undo(made.id)
    expect(undone.ok).toBe(true)
    expect(JSON.stringify((await store.get(made.id))?.doc)).toBe(original)
    // second round: another write lands after the batch
    const read2 = await engine.readCompact(made.id)
    if (!read2.ok) throw new Error('read')
    await engine.edit(made.id, {
      baseRevision: read2.revision,
      requestId: 'u2',
      steps: [{ op: 'replaceMarkdown', id: ids(read2.text)[0] as string, text: 'y' }],
    })
    const page = await store.get(made.id)
    await store.put(made.id, page?.doc as JsonObject)
    const refused = await engine.undo(made.id)
    expect(!refused.ok && refused.errors[0]?.code).toBe('changed_since')
  })

  it('refuses reading or editing a page whose stored blocks have no ids', async () => {
    const { engine, store, registry } = setup()
    const rec = await registry.create({ title: 'Old' })
    await store.put(rec.id, { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] })
    const r = await engine.readCompact(rec.id)
    expect(!r.ok && r.errors[0]?.code).toBe('ids_missing')
  })

  it('does not create a page when the text is refused, and leaves no record behind', async () => {
    const { engine, registry } = setup()
    const r = await engine.create({ title: 'Bad', text: '[x](javascript:alert(1))' })
    expect(r.ok).toBe(false)
    expect(await registry.children(null)).toHaveLength(0)
    expect(await registry.trash()).toHaveLength(0)
  })

  it('tree methods report registry errors as codes', async () => {
    const { engine } = setup()
    const a = await engine.create({ title: 'A' })
    if (!a.ok) throw new Error('a')
    const b = await engine.create({ title: 'B', parent: a.id })
    if (!b.ok) throw new Error('b')
    const cyc = await engine.move(a.id, b.id)
    expect(!cyc.ok && cyc.errors[0]?.code).toBe('cycle')
    expect((await engine.children(a.id)).map((c) => c.title)).toEqual(['B'])
    expect((await engine.trash(a.id)).ok).toBe(true)
    expect((await engine.restore(a.id)).ok).toBe(true)
    const found = await engine.search('B')
    expect(found.results.length).toBeGreaterThan(0)
  })
})

describe('pages engine on an open page', () => {
  it('works through the attached editor, so the editor shows the change', async () => {
    const { engine, store } = setup()
    const made = await engine.create({ text: 'open me' })
    if (!made.ok) throw new Error('create')
    const stored = await store.get(made.id)
    const { editor, destroy } = createTestEditor({ plugins: detachedPlugins, content: stored?.doc as JsonObject })
    const detach = engine.attach(made.id, editor)
    const read = await engine.readCompact(made.id)
    if (!read.ok) throw new Error('read')
    const r = await engine.edit(made.id, {
      baseRevision: read.revision,
      requestId: 'o',
      steps: [{ op: 'replaceMarkdown', id: ids(read.text)[0] as string, text: 'seen in editor' }],
    })
    expect(r.ok).toBe(true)
    expect(editor.getText()).toContain('seen in editor')
    expect((await store.get(made.id))?.revision).toBe(1) // saving is the editor's autosave, not the engine's
    detach()
    destroy()
  })
})

describe('detached editors', () => {
  it('never save on their own: the demo store is untouched by closed-page work', async () => {
    const before = Object.keys(localStorage).filter((k) => k.startsWith('page:doc:'))
    const { engine } = setup()
    const made = await engine.create({ text: 'x\n\ny' })
    if (!made.ok) throw new Error('create')
    const read = await engine.readCompact(made.id)
    if (!read.ok) throw new Error('read')
    await engine.edit(made.id, {
      baseRevision: read.revision,
      requestId: 'd',
      steps: [{ op: 'replaceMarkdown', id: ids(read.text)[0] as string, text: 'z' }],
    })
    expect(detachedPlugins.some((p) => p.id === 'persistence')).toBe(false)
    expect(Object.keys(localStorage).filter((k) => k.startsWith('page:doc:'))).toEqual(before)
  })
})
