// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryStore, type JsonObject, type PageStore } from '../src/editor/core'
import { loadPage } from './demoSession'

const doc = (t: string) =>
  ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] }) as JsonObject
const broken = (): PageStore => ({
  get: () => Promise.reject(new Error('IndexedDB blocked')),
  put: () => Promise.reject(new Error('x')),
  remove: () => Promise.reject(new Error('x')),
  list: () => Promise.reject(new Error('x')),
})

describe('loading with a primary store and a fallback', () => {
  beforeEach(() => localStorage.clear())

  it('falls back when the primary never held this page', async () => {
    const fallback = createMemoryStore()
    await fallback.put('p', doc('local copy'))
    const session = { store: broken(), revision: undefined as number | null | undefined }
    const loaded = await loadPage('p', { primary: broken(), fallback, session })
    expect(JSON.stringify(loaded.content)).toContain('local copy')
    expect(session.store).toBe(fallback)
  })

  it('does not open the older fallback copy once the primary has held the page', async () => {
    const primary = createMemoryStore()
    await primary.put('p', doc('newer in primary'))
    const fallback = createMemoryStore()
    await fallback.put('p', doc('stale local copy'))
    const session = { store: primary, revision: undefined as number | null | undefined }
    await loadPage('p', { primary, fallback, session }) // marks the primary as the authority
    const session2 = { store: primary, revision: undefined as number | null | undefined }
    await expect(loadPage('p', { primary: broken(), fallback, session: session2 })).rejects.toThrow()
    expect(session2.store).toBe(primary) // untouched: nothing was switched to the stale copy
  })

  it('refuses to open from the fallback when the primary is gone but held the page before', async () => {
    const primary = createMemoryStore()
    await loadPage('p', { primary, fallback: createMemoryStore(), session: { store: primary, revision: undefined } })
    const fallback = createMemoryStore()
    await fallback.put('p', doc('stale'))
    await expect(
      loadPage('p', { primary: null, fallback, session: { store: fallback, revision: undefined } }),
    ).rejects.toThrow()
  })

  it('records the loaded revision, or null for a new page', async () => {
    const primary = createMemoryStore()
    await primary.put('p', doc('x'))
    const s1 = { store: primary, revision: undefined as number | null | undefined }
    await loadPage('p', { primary, fallback: createMemoryStore(), session: s1 })
    expect(s1.revision).toBe(1)
    const s2 = { store: primary, revision: undefined as number | null | undefined }
    await loadPage('new', { primary, fallback: createMemoryStore(), session: s2 })
    expect(s2.revision).toBeNull()
  })
})
