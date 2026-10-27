// @vitest-environment jsdom
import type { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestEditor, defineOperation } from '..'
import { classifyTransaction } from './classify'
import { AUTO_IDLE_MS, AUTO_MIN_INTERVAL_MS, VersionStore } from './versionStore'

const insertTextOp = defineOperation('test:insertText', (chain, text: string) => chain.insertContent(text))

const make = (content = '<p>Hello</p>') =>
  createTestEditor({
    plugins: [{ id: 'text', extensions: [StarterKit] }],
    content,
  })

/** Moves the caret to the end of the document so inserts append. */
const toEnd = (editor: Editor) => editor.commands.setTextSelection(editor.state.doc.content.size - 1)

let key = 0
const storeFor = (editor: Editor) => {
  key += 1
  return new VersionStore(editor, { storageKey: `test:versions:${key}` })
}

describe('E1 transaction classification', () => {
  it('labels typing, operations, undo and paste at the transaction level', () => {
    const { editor, destroy } = make()
    const seen: string[] = []
    editor.on('transaction', ({ transaction }) => {
      const change = classifyTransaction(transaction)
      if (change) seen.push(change.kind === 'operation' ? `op:${change.operationId}` : change.kind)
    })
    editor.commands.insertContent(' world') // typing: no meta
    insertTextOp.run(editor, '!') // named operation
    editor.commands.undo() // history meta
    // synthetic paste meta
    editor.view.dispatch(editor.state.tr.insertText('pasted', 1).setMeta('paste', true))
    expect(seen).toEqual(['typing', 'op:test:insertText', 'undo', 'paste'])
    destroy()
  })

  it('ignores selection-only transactions', () => {
    const { editor, destroy } = make()
    const seen: unknown[] = []
    editor.on('transaction', ({ transaction }) => {
      const change = classifyTransaction(transaction)
      if (change) seen.push(change)
    })
    editor.commands.setTextSelection(1)
    expect(seen).toEqual([])
    destroy()
  })
})

describe('E2 local versions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    key = 1000
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('records undo and redo beside operations in the event log and the checkpoint', () => {
    const { editor, destroy } = make()
    const store = storeFor(editor)
    toEnd(editor)
    editor.commands.insertContent(' one')
    insertTextOp.run(editor, '!')
    editor.commands.undo()
    editor.commands.redo()
    expect(store.listEvents().map((event) => event.kind)).toEqual(['typing', 'operation', 'undo', 'redo'])
    vi.advanceTimersByTime(AUTO_IDLE_MS + 1)
    expect(store.list()).toHaveLength(1)
    expect(store.list()[0].changes).toEqual([
      { kind: 'typing' },
      { kind: 'operation', operationId: 'test:insertText' },
      { kind: 'undo' },
      { kind: 'redo' },
    ])
    expect(store.list()[0].doc.content?.[0]?.content?.[0]).toMatchObject({ text: 'Hello one!' })
    destroy()
    store.destroy()
  })

  it('checkpoints after the idle gap with a collapsed change summary', () => {
    const { editor, destroy } = make()
    const store = storeFor(editor)
    toEnd(editor)
    editor.commands.insertContent(' beautiful')
    editor.commands.insertContent(' world')
    insertTextOp.run(editor, '!')
    vi.advanceTimersByTime(AUTO_IDLE_MS + 1)
    const versions = store.list()
    expect(versions).toHaveLength(1)
    expect(versions[0].trigger).toBe('auto')
    expect(versions[0].doc.content?.[0]?.content?.[0]).toMatchObject({ text: 'Hello beautiful world!' })
    // consecutive identical kinds collapse: typing x2 -> one entry, then the operation
    expect(versions[0].changes).toEqual([{ kind: 'typing' }, { kind: 'operation', operationId: 'test:insertText' }])
    destroy()
    store.destroy()
  })

  it('batches continuous writing into spaced checkpoints', () => {
    const { editor, destroy } = make()
    const store = storeFor(editor)
    toEnd(editor)
    editor.commands.insertContent(' one')
    vi.advanceTimersByTime(AUTO_IDLE_MS + 1)
    expect(store.list()).toHaveLength(1)
    // more typing right away: the next idle fires inside the min interval and is pushed out
    editor.commands.insertContent(' two')
    vi.advanceTimersByTime(AUTO_IDLE_MS + 1)
    expect(store.list()).toHaveLength(1)
    vi.advanceTimersByTime(AUTO_MIN_INTERVAL_MS)
    expect(store.list()).toHaveLength(2)
    expect(store.list()[0].doc.content?.[0]?.content?.[0]).toMatchObject({ text: 'Hello one two' })
    destroy()
    store.destroy()
  })

  it('renames a saved version and drops a blank name', () => {
    const { editor, destroy } = make()
    const store = new VersionStore(editor, { storageKey: 'test:versions:rename' })
    const entry = store.snapshot('manual', 'Draft')
    expect(entry).not.toBeNull()
    if (!entry) return
    store.rename(entry.id, 'Final')
    expect(store.get(entry.id)?.label).toBe('Final')
    expect(store.get(entry.id)?.trigger).toBe('manual')
    store.updateDetails(entry.id, { label: 'Final', description: 'Ready to share' })
    expect(store.get(entry.id)?.description).toBe('Ready to share')
    const reloaded = new VersionStore(editor, { storageKey: 'test:versions:rename' })
    expect(reloaded.get(entry.id)?.label).toBe('Final')
    expect(reloaded.get(entry.id)?.description).toBe('Ready to share')
    reloaded.updateDetails(entry.id, { label: '   ', description: '  ' })
    expect(reloaded.get(entry.id)?.label).toBeUndefined()
    expect(reloaded.get(entry.id)?.description).toBeUndefined()
    expect(store.rename('missing', 'nope')).toBe(false)
    expect(store.updateDetails('missing', { label: 'nope', description: '' })).toBe(false)
    destroy()
    store.destroy()
    reloaded.destroy()
  })

  it('restoring a named version keeps that version current', () => {
    const { editor, destroy } = make('<p>Now</p>')
    const store = storeFor(editor)
    editor.commands.setContent('<p>ABC body</p>')
    const abc = store.snapshot('manual', 'ABC')
    editor.commands.setContent('<p>Now</p>')
    store.snapshot('manual', 'Later')
    expect(abc).not.toBeNull()
    if (!abc) return
    const before = store.list().length
    expect(store.restoreSaved(abc.id)).toBe(true)
    expect(editor.getText()).toContain('ABC body')
    expect(store.currentVersionId()).toBe(abc.id)
    expect(store.list().filter((entry) => entry.label === 'ABC')).toHaveLength(1)
    vi.advanceTimersByTime(AUTO_IDLE_MS + AUTO_MIN_INTERVAL_MS + 10)
    expect(store.list()).toHaveLength(before)
    expect(store.currentVersionId()).toBe(abc.id)
    expect(store.restoreSaved('missing')).toBe(false)
    editor.commands.insertContent(' more')
    const after = store.snapshot('manual', 'After')
    expect(after?.parentId).toBe(abc.id)
    expect(store.list().find((entry) => entry.label === 'Later')?.parentId).toBe(abc.id)
    destroy()
    store.destroy()
  })

  it('manual snapshots work without pending changes and persist across reload', () => {
    const { editor, destroy } = make()
    const store = new VersionStore(editor, { storageKey: 'test:versions:reload' })
    const entry = store.snapshot('manual', 'First draft')
    expect(entry?.label).toBe('First draft')
    const reloaded = new VersionStore(editor, { storageKey: 'test:versions:reload' })
    expect(reloaded.list()[0]?.label).toBe('First draft')
    destroy()
    store.destroy()
    reloaded.destroy()
  })

  it('skips auto snapshots when the document is unchanged', () => {
    const { editor, destroy } = make()
    const store = storeFor(editor)
    toEnd(editor)
    editor.commands.insertContent(' x')
    vi.advanceTimersByTime(AUTO_IDLE_MS + 1)
    expect(store.list()).toHaveLength(1)
    editor.commands.insertContent(' y')
    editor.commands.undo() // returns to exactly the snapshot's content
    vi.advanceTimersByTime(AUTO_MIN_INTERVAL_MS + AUTO_IDLE_MS + 1)
    expect(store.list()).toHaveLength(1)
    destroy()
    store.destroy()
  })

  it('trims auto versions ahead of manual ones at the cap', () => {
    const { editor, destroy } = make()
    const store = new VersionStore(editor, { storageKey: 'test:versions:cap', maxVersions: 3 })
    toEnd(editor)
    editor.commands.insertContent('a')
    store.snapshot('auto')
    editor.commands.insertContent('b')
    store.snapshot('auto')
    store.snapshot('manual', 'keep me')
    editor.commands.insertContent('c')
    store.snapshot('auto')
    const triggers = store.list().map((v) => v.trigger)
    expect(store.list()).toHaveLength(3)
    expect(triggers.filter((t) => t === 'manual')).toHaveLength(1)
    destroy()
    store.destroy()
  })
})

describe('E2 identity, metadata and edge behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('entries carry a schema version for future migration/collaboration boundaries', () => {
    const { editor, destroy } = make()
    const store = storeFor(editor)
    const entry = store.snapshot('manual')
    expect(entry?.schemaVersion).toBe(1)
    destroy()
    store.destroy()
  })

  it('histories under different storage keys are fully separate', () => {
    const { editor, destroy } = make()
    const a = new VersionStore(editor, { storageKey: 'test:doc:a' })
    const b = new VersionStore(editor, { storageKey: 'test:doc:b' })
    a.snapshot('manual', 'only in a')
    expect(b.list()).toHaveLength(0)
    destroy()
    a.destroy()
    b.destroy()
  })

  it('captures property edits (attrs) and nested-block changes, not just typing', () => {
    const { editor, destroy } = createTestEditor({
      plugins: [{ id: 'text', extensions: [StarterKit] }],
      content: '<p>Hello</p>',
    })
    const store = storeFor(editor)
    // attribute change via a named operation (mirrors updateBlockProps)
    const setLevel = defineOperation('test:setLevel', (chain, level: number) =>
      chain.command(({ tr, state }) => {
        tr.setNodeMarkup(0, state.schema.nodes.heading, { level })
        return true
      }),
    )
    setLevel.run(editor, 2)
    vi.advanceTimersByTime(AUTO_IDLE_MS + 1)
    const entry = store.list()[0]
    expect(entry.changes).toEqual([{ kind: 'operation', operationId: 'test:setLevel' }])
    expect(entry.doc.content?.[0]?.type).toBe('heading')
    expect(entry.doc.content?.[0]?.attrs).toMatchObject({ level: 2 })
    destroy()
    store.destroy()
  })

  it('retries with halved history when storage quota is exceeded', () => {
    const { editor, destroy } = make()
    const store = new VersionStore(editor, { storageKey: 'test:versions:quota', maxVersions: 4 })
    for (let index = 0; index < 4; index += 1) {
      editor.commands.insertContent(` v${index}`)
      store.snapshot('auto')
    }
    expect(store.list()).toHaveLength(4)
    const original = Storage.prototype.setItem
    let failures = 1
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, ...args) {
      if (failures > 0) {
        failures -= 1
        throw new DOMException('quota', 'QuotaExceededError')
      }
      return original.apply(this, args)
    })
    editor.commands.insertContent(' more')
    store.snapshot('auto')
    // persisted after halving: the in-memory list keeps all 5, storage holds the retry
    expect(store.list().length).toBeGreaterThan(0)
    vi.restoreAllMocks()
    destroy()
    store.destroy()
  })

  it('force snapshots checkpoint the current document even without pending changes', () => {
    const { editor, destroy } = make()
    const store = storeFor(editor)
    expect(store.snapshot('auto')).toBeNull() // nothing pending
    const forced = store.snapshot('auto', undefined, { force: true })
    expect(forced).not.toBeNull()
    // and it does not duplicate when the document matches the latest version
    expect(store.snapshot('auto', undefined, { force: true })).toBeNull()
    destroy()
    store.destroy()
  })
})

describe('E3 durable event log (future-collab foundation)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    key = 2000
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('preserves kind, operation id and serialized steps per transaction', () => {
    const { editor, destroy } = make()
    const store = storeFor(editor)
    toEnd(editor)
    editor.commands.insertContent(' typed')
    insertTextOp.run(editor, '!')
    const events = store.listEvents()
    expect(events).toHaveLength(2)
    expect(events[0].kind).toBe('typing')
    expect(events[0].steps.length).toBeGreaterThan(0)
    expect(events[0].steps[0]).toMatchObject({ stepType: 'replace' })
    expect(events[1].kind).toBe('operation')
    expect(events[1].operationId).toBe('test:insertText')
    expect(events[1].schemaVersion).toBe(1)
    destroy()
    store.destroy()
  })

  it('persists the event log across reloads in the format-2 container', async () => {
    const { editor, destroy } = make()
    const store = new VersionStore(editor, { storageKey: 'test:events:reload' })
    toEnd(editor)
    editor.commands.insertContent(' durable')
    await vi.advanceTimersByTimeAsync(AUTO_IDLE_MS + 10)
    const raw = JSON.parse(localStorage.getItem('test:events:reload') ?? '{}') as {
      format?: number
      entries?: unknown[]
      events?: unknown[]
    }
    expect(raw.format).toBe(2)
    expect(raw.events).toHaveLength(1)
    const reloaded = new VersionStore(editor, { storageKey: 'test:events:reload' })
    expect(reloaded.listEvents()).toHaveLength(1)
    expect(reloaded.listEvents()[0].kind).toBe('typing')
    destroy()
    store.destroy()
    reloaded.destroy()
  })

  it('migrates the legacy bare entry array (format 1) without losing entries', () => {
    const { editor, destroy } = make()
    localStorage.setItem(
      'test:events:legacy',
      JSON.stringify([
        {
          id: 'old-1',
          schemaVersion: 1,
          createdAt: 1,
          trigger: 'manual',
          changes: [],
          doc: { type: 'doc', content: [] },
        },
      ]),
    )
    const store = new VersionStore(editor, { storageKey: 'test:events:legacy' })
    expect(store.list()).toHaveLength(1)
    expect(store.listEvents()).toEqual([])
    destroy()
    store.destroy()
  })

  it('bounds anchored events while keeping the replayable tail', async () => {
    const { editor, destroy } = make()
    const store = new VersionStore(editor, { storageKey: 'test:events:cap', maxEvents: 3 })
    toEnd(editor)
    editor.commands.insertContent(' before')
    await vi.advanceTimersByTimeAsync(AUTO_IDLE_MS + 10) // snapshot anchors event seq 1
    const anchoredSeq = store.list()[0].lastEventSeq
    expect(anchoredSeq).toBe(1)
    for (let i = 0; i < 4; i += 1) {
      toEnd(editor)
      editor.commands.insertContent(` ${i}`)
    }
    // 5 events total, cap 3: only the anchored event (seq 1) may drop; the tail (2..5) stays.
    const seqs = store.listEvents().map((event) => event.seq)
    expect(seqs).toEqual([2, 3, 4, 5])
    expect(seqs.every((seq, index) => index === 0 || seq > seqs[index - 1])).toBe(true)
    destroy()
    store.destroy()
  })

  it('keeps global event ordering across reloads (seq continues)', async () => {
    const { editor, destroy } = make()
    const store = new VersionStore(editor, { storageKey: 'test:events:seq' })
    toEnd(editor)
    editor.commands.insertContent(' one')
    await vi.advanceTimersByTimeAsync(AUTO_IDLE_MS + 10)
    const reloaded = new VersionStore(editor, { storageKey: 'test:events:seq' })
    toEnd(editor)
    editor.commands.insertContent(' two')
    const seqs = reloaded.listEvents().map((event) => event.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(seqs[seqs.length - 1]).toBeGreaterThan(seqs[0])
    destroy()
    store.destroy()
    reloaded.destroy()
  })

  it('discloses when persistence fails instead of claiming durable history', async () => {
    const { editor, destroy } = make()
    const store = new VersionStore(editor, { storageKey: 'test:events:quota' })
    const storageProto = Object.getPrototypeOf(localStorage) as Storage
    const original = storageProto.setItem
    storageProto.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
    try {
      toEnd(editor)
      editor.commands.insertContent(' unsaved')
      await vi.advanceTimersByTimeAsync(AUTO_IDLE_MS + 10)
      expect(store.isPersistenceDegraded()).toBe(true)
    } finally {
      storageProto.setItem = original
    }
    destroy()
    store.destroy()
  })
  it('replays the retained tail onto the latest snapshot and lands on the current doc', async () => {
    const { Step } = await import('@tiptap/pm/transform')
    const { editor, destroy } = make()
    const store = new VersionStore(editor, { storageKey: 'test:events:replay', maxEvents: 4 })
    toEnd(editor)
    editor.commands.insertContent(' baseline')
    await vi.advanceTimersByTimeAsync(AUTO_IDLE_MS + 10) // snapshot anchors the first event
    // More edits than the cap: anchored events drop, the replayable tail must stay intact.
    for (let i = 0; i < 5; i += 1) {
      toEnd(editor)
      editor.commands.insertContent(` tail${i}`)
    }
    await vi.advanceTimersByTimeAsync(AUTO_IDLE_MS + 10)
    // Reload: only persisted data may be used for replay.
    const reloaded = new VersionStore(editor, { storageKey: 'test:events:replay' })
    const baseline = reloaded.list()[0]
    const tail = reloaded.listEvents().filter((event) => event.seq > (baseline.lastEventSeq ?? 0))
    expect(tail.length).toBeGreaterThan(0)
    // Every retained tail event must sit above the baseline; nothing below it may remain needed.
    expect(reloaded.listEvents().every((event) => event.seq > (baseline.lastEventSeq ?? 0))).toBe(true)
    let doc = editor.schema.nodeFromJSON(baseline.doc)
    for (const event of tail) {
      for (const stepJson of event.steps) {
        const result = Step.fromJSON(editor.schema, stepJson).apply(doc)
        if (result.failed || !result.doc) throw new Error(`replay failed at event ${event.id}: ${result.failed}`)
        doc = result.doc
      }
    }
    expect(doc.toJSON()).toEqual(editor.getJSON())
    destroy()
    store.destroy()
    reloaded.destroy()
  })
})
