// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createIndexedDbSidecar, getSidecarStorage, setSidecarStorage } from './sidecarStorage'

let n = 0
const dbName = () => `sidecar-test-${n++}`

describe('sidecar storage', () => {
  beforeEach(() => {
    localStorage.clear()
    setSidecarStorage(null)
  })

  it('defaults to localStorage', () => {
    getSidecarStorage().setItem('page:versions:a', 'x')
    expect(localStorage.getItem('page:versions:a')).toBe('x')
  })

  it('persists writes across a new instance and removes keys', async () => {
    const name = dbName()
    const a = createIndexedDbSidecar({ name })
    await a.ready()
    a.setItem('page:comments:p', '{"a":1}')
    a.setItem('page:versions:p', 'v')
    a.removeItem('page:versions:p')
    expect(a.getItem('page:comments:p')).toBe('{"a":1}')
    await a.flush()
    const b = createIndexedDbSidecar({ name })
    await b.ready()
    expect(b.getItem('page:comments:p')).toBe('{"a":1}')
    expect(b.getItem('page:versions:p')).toBeNull()
  })

  it('imports older localStorage copies once and leaves them in place', async () => {
    const name = dbName()
    localStorage.setItem('page:versions:p', 'old')
    localStorage.setItem('other:key', 'ignored')
    const a = createIndexedDbSidecar({ name })
    await a.ready()
    expect(a.getItem('page:versions:p')).toBe('old')
    expect(a.getItem('other:key')).toBeNull()
    expect(localStorage.getItem('page:versions:p')).toBe('old')
    // a newer value in IndexedDB is not overwritten by the stale localStorage copy on the next start
    a.setItem('page:versions:p', 'new')
    await a.flush()
    const b = createIndexedDbSidecar({ name })
    await b.ready()
    expect(b.getItem('page:versions:p')).toBe('new')
    // a record deleted in IndexedDB does not come back from localStorage either
    b.removeItem('page:versions:p')
    await b.flush()
    const c = createIndexedDbSidecar({ name })
    await c.ready()
    expect(c.getItem('page:versions:p')).toBeNull()
  })

  it('reports a failed background write through onWriteError and flush', async () => {
    const a = createIndexedDbSidecar({ name: dbName() })
    await a.ready()
    let seen: unknown = null
    a.onWriteError = (e) => (seen = e)
    a.setItem('k', 'v'.repeat(10))
    await a.flush()
    expect(seen).toBeNull()
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = () => {
      throw new Error('quota')
    }
    try {
      a.setItem('k2', 'v')
      await expect(a.flush()).rejects.toThrow('quota')
      expect(seen).toBeInstanceOf(Error)
    } finally {
      IDBObjectStore.prototype.put = original
    }
  })
})
