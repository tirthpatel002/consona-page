import type { PageChange } from './types'

export interface ChangeFeed {
  /** Tells this tab's listeners and, when a channel name was given, other tabs on the same origin. */
  readonly publish: (change: PageChange) => void
  readonly subscribe: (listener: (change: PageChange) => void) => () => void
}

const isChange = (value: unknown): value is PageChange => {
  if (typeof value !== 'object' || value === null) return false
  const { id, revision } = value as { id?: unknown; revision?: unknown }
  return typeof id === 'string' && (revision === null || (typeof revision === 'number' && Number.isInteger(revision)))
}

/**
 * A small publish/subscribe feed for page changes. With a channel name it also uses BroadcastChannel,
 * which never delivers to the sender, so one tab hears about another tab's writes exactly once. Where
 * BroadcastChannel does not exist, other tabs are simply not told (they still find out on their next save).
 */
export function createChangeFeed(channelName?: string): ChangeFeed {
  const listeners = new Set<(change: PageChange) => void>()
  const emit = (change: PageChange) => listeners.forEach((listener) => listener(change))
  let channel: BroadcastChannel | null = null
  if (channelName && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(channelName)
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (isChange(event.data)) emit(event.data)
    }
  }
  return {
    publish: (change) => {
      emit(change)
      try {
        channel?.postMessage(change)
      } catch {
        // A closed channel must not fail a save that already succeeded.
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
