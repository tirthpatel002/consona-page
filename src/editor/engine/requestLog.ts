/** What is kept of a finished edit, so a retry with the same request id can be answered without applying it again. */
export interface LoggedEdit {
  readonly revision: string
  readonly applied: number
  /** Store revision of the page after the edit, for closed pages. */
  readonly storeRevision?: number
}

/**
 * Remembers the last few successful edits per page across reloads. Failed edits are not kept: a retry after a
 * failure runs again, which is what the caller wants once they have re-read the page.
 */
export interface RequestLog {
  get(pageId: string, requestId: string): Promise<LoggedEdit | null>
  put(pageId: string, requestId: string, entry: LoggedEdit): Promise<void>
  clear(pageId: string): Promise<void>
}

export const REQUEST_LOG_LIMIT = 20

type Entries = [string, LoggedEdit][]

const valid = (raw: unknown): Entries => {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (e): e is [string, LoggedEdit] =>
      Array.isArray(e) &&
      typeof e[0] === 'string' &&
      typeof e[1] === 'object' &&
      e[1] !== null &&
      typeof (e[1] as LoggedEdit).revision === 'string' &&
      typeof (e[1] as LoggedEdit).applied === 'number',
  )
}

export function createMemoryRequestLog(): RequestLog {
  const map = new Map<string, Entries>()
  return {
    get: (pageId, requestId) => Promise.resolve((map.get(pageId) ?? []).find(([id]) => id === requestId)?.[1] ?? null),
    put: (pageId, requestId, entry) => {
      const kept = (map.get(pageId) ?? []).filter(([id]) => id !== requestId)
      map.set(pageId, [...kept, [requestId, entry] as [string, LoggedEdit]].slice(-REQUEST_LOG_LIMIT))
      return Promise.resolve()
    },
    clear: (pageId) => {
      map.delete(pageId)
      return Promise.resolve()
    },
  }
}

export function createLocalStorageRequestLog(backing?: Storage): RequestLog {
  const area = (): Storage => backing ?? localStorage
  const key = (pageId: string) => `page:requests:${pageId}`
  const read = (pageId: string): Entries => {
    try {
      return valid(JSON.parse(area().getItem(key(pageId)) ?? 'null'))
    } catch {
      return []
    }
  }
  return {
    get: (pageId, requestId) => Promise.resolve(read(pageId).find(([id]) => id === requestId)?.[1] ?? null),
    put: (pageId, requestId, entry) => {
      try {
        const kept = read(pageId).filter(([id]) => id !== requestId)
        area().setItem(key(pageId), JSON.stringify([...kept, [requestId, entry]].slice(-REQUEST_LOG_LIMIT)))
        return Promise.resolve()
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error('Could not save the request log.'))
      }
    },
    clear: (pageId) => {
      area().removeItem(key(pageId))
      return Promise.resolve()
    },
  }
}
