/**
 * Lets one tab ask the others whether they hold unsaved page changes, before an action that deletes data
 * (removing unused files). A tab that is saving, failed to save or has a conflict answers "dirty". If another
 * tab does not answer within the time limit it is not counted, so this lowers the risk and does not remove it.
 */
const CHANNEL = 'page-tab-coordination'

export interface TabAnswer {
  readonly tabs: number
  readonly dirty: number
}

export interface Responder {
  stop(): void
}

export function startTabResponder(isDirty: () => boolean, name: string = CHANNEL): Responder {
  if (typeof BroadcastChannel === 'undefined') return { stop: () => undefined }
  const channel = new BroadcastChannel(name)
  channel.onmessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; id?: string } | null
    if (data?.type === 'ask' && typeof data.id === 'string') {
      channel.postMessage({ type: 'answer', id: data.id, dirty: isDirty() })
    }
  }
  return { stop: () => channel.close() }
}

/** Resolves with how many other tabs answered and how many of them are dirty, or null when tabs cannot be asked. */
export function askOtherTabs(waitMs = 600, name: string = CHANNEL): Promise<TabAnswer | null> {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(name)
    const id = Math.random().toString(36).slice(2)
    let tabs = 0
    let dirty = 0
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; id?: string; dirty?: boolean } | null
      if (data?.type !== 'answer' || data.id !== id) return
      tabs += 1
      if (data.dirty !== false) dirty += 1
    }
    channel.postMessage({ type: 'ask', id })
    setTimeout(() => {
      channel.close()
      resolve({ tabs, dirty })
    }, waitMs)
  })
}

/** Why a delete should not run, given the answers, or null when it may. A tab that cannot be asked refuses. */
export const refuseIfOtherTabsDirty = (answer: TabAnswer | null): string | null =>
  answer === null
    ? 'Other tabs could not be checked, so unused files were not removed.'
    : answer.dirty > 0
      ? 'Another tab has unsaved changes. Let it finish saving, then try again.'
      : null
