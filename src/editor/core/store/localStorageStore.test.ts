// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalStorageStore, StaleRevisionError } from './index'

const doc = (t: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] })

describe('localStorage page store', () => {
  beforeEach(() => localStorage.clear())
  it('reads the original format as revision 1 and keeps the format on write', async () => {
    localStorage.setItem('page:doc:a', JSON.stringify(doc('old')))
    const store = createLocalStorageStore()
    expect((await store.get('a'))?.revision).toBe(1)
    await store.put('a', doc('new'), { expectedRevision: 1 })
    expect(JSON.parse(localStorage.getItem('page:doc:a') ?? 'null')).toEqual(doc('new'))
    expect((await store.get('a'))?.revision).toBe(2)
  })
  it('rejects a stale write', async () => {
    const store = createLocalStorageStore()
    await store.put('a', doc('x'))
    await expect(store.put('a', doc('y'), { expectedRevision: 5 })).rejects.toBeInstanceOf(StaleRevisionError)
  })
})
