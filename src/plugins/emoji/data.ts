/**
 * Full emoji coverage backed by the maintained `emojibase-data` package (MIT), lazy-loaded via
 * dynamic import so the 560 KB dataset stays out of the initial bundle. Categories follow
 * Notion's picker (Smileys & People ... Flags); skin-tone variants come from the dataset's
 * `skins` where provided.
 */
export interface EmojiEntry {
  readonly char: string
  readonly name: string
  readonly group: string
  readonly keywords: readonly string[]
  /** Skin-tone variants by tone index 1-5 (light .. dark), when the dataset provides them. */
  readonly tones?: Readonly<Record<number, string>>
}

interface RawEmoji {
  readonly group?: number
  readonly label?: string
  readonly tags?: readonly string[]
  readonly hexcode?: string
  readonly version?: number
  readonly skins?: readonly { readonly hexcode: string }[]
}

/**
 * Newest Unicode version exposed in the picker. Glyphs newer than the fonts broadly deployed on
 * user devices (and than the verification environment's Noto Color Emoji 15.0) render as tofu
 * boxes, so they are filtered out. Raise this constant as font support catches up.
 */
export const MAX_EMOJI_VERSION = 15

const fromHexcode = (hexcode: string): string =>
  String.fromCodePoint(...hexcode.split('-').map((part) => parseInt(part, 16)))

const GROUP_NAMES: Record<number, string> = {
  0: 'Smileys & People',
  1: 'Smileys & People',
  3: 'Animals & Nature',
  4: 'Food & Drink',
  5: 'Travel & Places',
  6: 'Activity',
  7: 'Objects',
  8: 'Symbols',
  9: 'Flags',
}

let cache: readonly EmojiEntry[] = []
let loading: Promise<readonly EmojiEntry[]> | null = null

/** Loads (once) and returns the full emoji set. Safe to call repeatedly. */
export const loadEmojis = (): Promise<readonly EmojiEntry[]> => {
  if (cache.length > 0) return Promise.resolve(cache)
  loading ??= import('emojibase-data/en/data.json')
    .then((module) => {
      const raw = module.default as readonly RawEmoji[]
      const entries: EmojiEntry[] = []
      for (const item of raw) {
        if (item.group === undefined || !item.label || !item.hexcode) continue
        if ((item.version ?? 0) > MAX_EMOJI_VERSION) continue // unsupported by deployed fonts
        const group = GROUP_NAMES[item.group]
        if (!group) continue // component/modifier entries are not directly insertable choices
        const tones: Record<number, string> = {}
        for (const [index, skin] of (item.skins ?? []).entries()) tones[index + 1] = fromHexcode(skin.hexcode)
        entries.push({
          char: fromHexcode(item.hexcode),
          name: item.label.replace(/^flag: /, 'flag '),
          group,
          keywords: item.tags ?? [],
          ...(Object.keys(tones).length > 0 ? { tones } : {}),
        })
      }
      cache = entries
      return cache
    })
    .catch((error: unknown) => {
      loading = null // allow a retry on the next open/trigger instead of caching a rejection
      throw error
    })
  return loading
}

/** The loaded emoji set; empty until `loadEmojis()` resolves. */
export const getEmojis = (): readonly EmojiEntry[] => cache

export type SkinTone = 0 | 1 | 2 | 3 | 4 | 5

/** The character to insert/display for an entry at a tone (0 = default yellow/neutral). */
export const applyTone = (entry: EmojiEntry, tone: SkinTone): string =>
  tone > 0 ? (entry.tones?.[tone] ?? entry.char) : entry.char

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Ranked emoji search over the loaded set: name prefix > name word prefix > keyword/group
 * prefix > substring. An empty query returns dataset order (picker browsing).
 */
export const filterEmojis = (query: string, limit = 40): readonly EmojiEntry[] => {
  const source = getEmojis()
  const q = normalize(query)
  if (q === '') return source.slice(0, limit)
  const rank = (entry: EmojiEntry): number => {
    const name = normalize(entry.name)
    if (name === q) return 0
    if (name.startsWith(q)) return 1
    if (name.split(' ').some((word) => word.startsWith(q))) return 2
    const extra = [...entry.keywords, entry.group].map(normalize)
    if (extra.some((word) => word.startsWith(q))) return 3
    if (name.includes(q) || extra.some((word) => word.includes(q))) return 4
    return -1
  }
  return source
    .map((entry, index) => ({ entry, index, score: rank(entry) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((x) => x.entry)
}

const TONE_KEY = 'page:emoji-tone'

/** The user's persisted skin-tone preference for supported emoji (0 = default). */
export const selectedTone = (): SkinTone => {
  try {
    const raw = Number(localStorage.getItem(TONE_KEY) ?? '0')
    return (raw >= 0 && raw <= 5 ? raw : 0) as SkinTone
  } catch {
    return 0
  }
}

export const persistTone = (tone: SkinTone): void => {
  try {
    localStorage.setItem(TONE_KEY, String(tone))
  } catch {
    // storage unavailable: tone just doesn't persist
  }
}
