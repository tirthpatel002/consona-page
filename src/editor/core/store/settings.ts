/** How AI edits to a page are applied: shown for Accept/Discard first (`ask`, the default), or applied directly. */
export type AiReviewMode = 'ask' | 'apply'

/**
 * Per-page settings kept next to the page, not inside its body. `locked` is the persisted copy of the page
 * lock, so code that works on a closed page can honour it. `aiReview` is the "Never ask me again" choice.
 */
export interface PageSettings {
  readonly locked: boolean
  readonly aiReview: AiReviewMode
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = { locked: false, aiReview: 'ask' }

/** Anything that is not a valid value reads as the default, so a damaged record never opens a page for editing or skips a review. */
export function normalizeSettings(raw: unknown): PageSettings {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    locked: value.locked === true,
    aiReview: value.aiReview === 'apply' ? 'apply' : 'ask',
  }
}

export interface PageSettingsStore {
  get(pageId: string): Promise<PageSettings>
  /** Changes some settings and returns the result. Unknown keys are ignored. */
  set(pageId: string, patch: Partial<PageSettings>): Promise<PageSettings>
  /** Forgets a page's settings (called when the page is deleted for good). */
  remove(pageId: string): Promise<void>
}

/** Storage for the raw records. Must reject, not swallow, a failed write. */
export interface SettingsStorage {
  read(pageId: string): Promise<unknown>
  write(pageId: string, value: PageSettings): Promise<void>
  erase(pageId: string): Promise<void>
}

export function createSettingsStore(storage: SettingsStorage): PageSettingsStore {
  const get = async (pageId: string) => normalizeSettings(await storage.read(pageId))
  return {
    get,
    async set(pageId, patch) {
      const next = normalizeSettings({ ...(await get(pageId)), ...patch })
      await storage.write(pageId, next)
      return next
    },
    remove: (pageId) => storage.erase(pageId),
  }
}

export function createMemorySettingsStorage(): SettingsStorage {
  const map = new Map<string, unknown>()
  return {
    read: (id) => Promise.resolve(map.get(id)),
    write: (id, value) => {
      map.set(id, value)
      return Promise.resolve()
    },
    erase: (id) => {
      map.delete(id)
      return Promise.resolve()
    },
  }
}

const keyFor = (pageId: string) => `page:settings:${pageId}`

export function createLocalStorageSettingsStorage(backing?: Storage): SettingsStorage {
  // Looked up on use, so importing this file never needs a browser.
  const area = (): Storage => backing ?? localStorage
  return {
    read: (id) => {
      try {
        return Promise.resolve(JSON.parse(area().getItem(keyFor(id)) ?? 'null') as unknown)
      } catch {
        return Promise.resolve(null)
      }
    },
    write: (id, value) => {
      try {
        area().setItem(keyFor(id), JSON.stringify(value))
        return Promise.resolve()
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error('Could not save the page settings.'))
      }
    },
    erase: (id) => {
      area().removeItem(keyFor(id))
      return Promise.resolve()
    },
  }
}
