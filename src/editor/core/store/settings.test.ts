import { describe, expect, it } from 'vitest'
import { createMemoryRegistryStorage, createPageRegistry } from './registry'
import { createMemoryStore } from './memoryStore'
import {
  createLocalStorageSettingsStorage,
  createMemorySettingsStorage,
  createSettingsStore,
  DEFAULT_PAGE_SETTINGS,
  normalizeSettings,
} from './settings'

describe('page settings', () => {
  it('defaults to unlocked and ask-first', async () => {
    const settings = createSettingsStore(createMemorySettingsStorage())
    expect(await settings.get('p')).toEqual(DEFAULT_PAGE_SETTINGS)
  })

  it('changes one setting at a time and ignores unknown keys', async () => {
    const settings = createSettingsStore(createMemorySettingsStorage())
    await settings.set('p', { aiReview: 'apply' })
    await settings.set('p', { locked: true, bogus: 1 } as never)
    expect(await settings.get('p')).toEqual({ locked: true, aiReview: 'apply' })
    expect(await settings.get('other')).toEqual(DEFAULT_PAGE_SETTINGS)
  })

  it('reads damaged records as the defaults, so a damaged record never skips a review', () => {
    expect(normalizeSettings('junk')).toEqual(DEFAULT_PAGE_SETTINGS)
    expect(normalizeSettings({ locked: 'yes', aiReview: 'always' })).toEqual(DEFAULT_PAGE_SETTINGS)
    expect(normalizeSettings({ aiReview: 'apply' }).aiReview).toBe('apply')
  })

  it('survives a reload through localStorage and a failed write is reported, not swallowed', async () => {
    const backing = new Map<string, string>()
    const storage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    } as unknown as Storage
    await createSettingsStore(createLocalStorageSettingsStorage(storage)).set('p', { locked: true })
    expect((await createSettingsStore(createLocalStorageSettingsStorage(storage)).get('p')).locked).toBe(true)
    const full = {
      ...storage,
      getItem: storage.getItem.bind(storage),
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: storage.removeItem.bind(storage),
    } as unknown as Storage
    await expect(
      createSettingsStore(createLocalStorageSettingsStorage(full)).set('p', { locked: false }),
    ).rejects.toThrow()
    expect((await createSettingsStore(createLocalStorageSettingsStorage(storage)).get('p')).locked).toBe(true)
  })

  it('deleting a page for good forgets its settings', async () => {
    const pages = createMemoryStore()
    const settings = createSettingsStore(createMemorySettingsStorage())
    const registry = createPageRegistry({ storage: createMemoryRegistryStorage(), pages, settings })
    const page = await registry.create({ title: 'x' })
    await pages.put(page.id, { type: 'doc', content: [] })
    await settings.set(page.id, { locked: true })
    await registry.moveToTrash(page.id)
    await registry.deleteForever(page.id)
    expect(await settings.get(page.id)).toEqual(DEFAULT_PAGE_SETTINGS)
  })
})
