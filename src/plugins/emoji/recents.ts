import type { EmojiEntry } from './data'
import { getEmojis } from './data'

const KEY = 'page:emoji-recents'
const MAX = 16

/** Recently picked emoji (picker + ":" completion), most recent first. localStorage-backed. */
export const recentEmojis = (): readonly EmojiEntry[] => {
  try {
    const names = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    if (!Array.isArray(names)) return []
    return names.flatMap((name) => {
      const found = getEmojis().find((entry) => entry.name === name)
      return found ? [found] : []
    })
  } catch {
    return []
  }
}

export const recordEmoji = (entry: EmojiEntry): void => {
  try {
    const rest = recentEmojis().filter((recent) => recent.name !== entry.name)
    localStorage.setItem(KEY, JSON.stringify([entry.name, ...rest.map((recent) => recent.name)].slice(0, MAX)))
  } catch {
    // storage unavailable (private mode): recents simply don't persist
  }
}
