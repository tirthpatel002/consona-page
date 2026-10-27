import { describe, expect, it } from 'vitest'
import { createLocalStorageRequestLog, createMemoryRequestLog, REQUEST_LOG_LIMIT } from './requestLog'

const backing = () => {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } as unknown as Storage
}

describe('request log', () => {
  it('keeps only the last few requests per page', async () => {
    const log = createMemoryRequestLog()
    for (let i = 0; i < REQUEST_LOG_LIMIT + 5; i += 1)
      await log.put('p', `r${String(i)}`, { revision: 'x', applied: 1 })
    expect(await log.get('p', 'r0')).toBeNull()
    expect(await log.get('p', `r${String(REQUEST_LOG_LIMIT + 4)}`)).not.toBeNull()
    expect(await log.get('other', 'r30')).toBeNull()
  })

  it('survives a reload through localStorage, and ignores damaged data', async () => {
    const storage = backing()
    await createLocalStorageRequestLog(storage).put('p', 'a', { revision: 'r1', applied: 2 })
    expect(await createLocalStorageRequestLog(storage).get('p', 'a')).toEqual({ revision: 'r1', applied: 2 })
    storage.setItem('page:requests:p', '{"not":"a list"}')
    expect(await createLocalStorageRequestLog(storage).get('p', 'a')).toBeNull()
    storage.setItem('page:requests:p', 'not json')
    expect(await createLocalStorageRequestLog(storage).get('p', 'a')).toBeNull()
  })

  it('clear forgets a page', async () => {
    const log = createMemoryRequestLog()
    await log.put('p', 'a', { revision: 'r', applied: 1 })
    await log.clear('p')
    expect(await log.get('p', 'a')).toBeNull()
  })
})
