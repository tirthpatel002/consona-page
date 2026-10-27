import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import {
  applyTone,
  filterEmojis,
  getEmojis,
  loadEmojis,
  persistTone,
  selectedTone,
  type EmojiEntry,
  type SkinTone,
} from './data'
import { Icon, lucideStrokeForSize, type IconName } from '../../editor/core'
import { insertEmoji } from './operations'
import { recentEmojis, recordEmoji } from './recents'

const GRID_LIMIT = 72
const TONE_SAMPLE: EmojiEntry = {
  char: '\u{1F44B}',
  name: 'waving hand',
  group: 'Smileys & People',
  keywords: [],
  tones: {
    1: '\u{1F44B}\u{1F3FB}',
    2: '\u{1F44B}\u{1F3FC}',
    3: '\u{1F44B}\u{1F3FD}',
    4: '\u{1F44B}\u{1F3FE}',
    5: '\u{1F44B}\u{1F3FF}',
  },
}
const COLUMNS = 9

interface Section {
  readonly group: string
  readonly entries: readonly EmojiEntry[]
  /** Index of the section's first entry in the flattened list (for arrow-key addressing). */
  readonly start: number
}

const sectionize = (entries: readonly EmojiEntry[], start = 0): Section[] => {
  const out: { group: string; entries: EmojiEntry[]; start: number }[] = []
  for (const entry of entries) {
    const last = out[out.length - 1]
    if (last && last.group === entry.group) last.entries.push(entry)
    else out.push({ group: entry.group, entries: [entry], start: start + entries.indexOf(entry) })
  }
  return out
}

type CategoryGroup =
  | 'Smileys & People'
  | 'Animals & Nature'
  | 'Food & Drink'
  | 'Activity'
  | 'Travel & Places'
  | 'Objects'
  | 'Symbols'
  | 'Flags'

type EmojiTabId = 'recent' | CategoryGroup

const EMOJI_TABS: readonly { readonly id: EmojiTabId; readonly title: string; readonly icon: IconName }[] = [
  { id: 'recent', title: 'Frequently used', icon: 'emoji-recent' },
  { id: 'Smileys & People', title: 'Smileys & People', icon: 'emoji-smileys' },
  { id: 'Animals & Nature', title: 'Animals & Nature', icon: 'emoji-nature' },
  { id: 'Food & Drink', title: 'Food & Drink', icon: 'emoji-food' },
  { id: 'Activity', title: 'Activity', icon: 'emoji-activity' },
  { id: 'Travel & Places', title: 'Travel & Places', icon: 'emoji-travel' },
  { id: 'Objects', title: 'Objects', icon: 'emoji-objects' },
  { id: 'Symbols', title: 'Symbols', icon: 'emoji-symbols' },
  { id: 'Flags', title: 'Flags', icon: 'emoji-flags' },
]

const browseTabSections = (tab: EmojiTabId, recents: readonly EmojiEntry[], columns: number): Section[] => {
  if (tab === 'recent') {
    const entries = recents.slice(0, columns * 4)
    return entries.length > 0 ? [{ group: 'Frequently used', entries, start: 0 }] : []
  }
  const entries = getEmojis().filter((entry) => entry.group === tab)
  return entries.length > 0 ? [{ group: tab, entries, start: 0 }] : []
}

/**
 * Notion-style emoji picker: search, categories, frequently-used recents, arrow-key grid.
 * With an editor, a pick inserts into the document. `onSelect` receives the character instead
 * (the page banner uses this and does not insert).
 */
export function EmojiPicker({
  editor,
  close,
  onSelect,
}: {
  readonly editor?: Editor
  readonly close: () => void
  readonly onSelect?: (emoji: string) => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [recents, setRecents] = useState<readonly EmojiEntry[]>(recentEmojis)
  const [tone, setTone] = useState<SkinTone>(selectedTone)
  const [tab, setTab] = useState<EmojiTabId>('recent')
  const [loaded, setLoaded] = useState(getEmojis().length > 0)
  const bodyRef = useRef<HTMLDivElement>(null)

  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!loaded)
      loadEmojis().then(
        () => {
          setLoaded(true)
          setRecents(recentEmojis())
        },
        () => setFailed(true),
      )
  }, [loaded])

  const searching = query.trim() !== ''
  const sections = useMemo<Section[]>(
    () => (searching ? sectionize(filterEmojis(query, GRID_LIMIT)) : browseTabSections(tab, recents, COLUMNS)),
    [query, searching, recents, tab],
  )
  const flat = useMemo(() => sections.flatMap((section) => section.entries), [sections])

  // Reset the active cell when the query or category tab changes (render-phase derived reset).
  const [lastQuery, setLastQuery] = useState(query)
  const [lastTab, setLastTab] = useState(tab)
  if (lastQuery !== query) {
    setLastQuery(query)
    setActive(0)
  }
  if (lastTab !== tab) {
    setLastTab(tab)
    setActive(0)
  }
  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0)
  }, [tab])
  useEffect(() => {
    bodyRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (entry: EmojiEntry) => {
    recordEmoji(entry)
    setRecents(recentEmojis())
    const emoji = applyTone(entry, tone)
    if (onSelect) onSelect(emoji)
    else if (editor) insertEmoji.run(editor, emoji)
    close()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (flat.length === 0) return
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLUMNS,
      ArrowUp: -COLUMNS,
    }
    if (event.key in moves) {
      event.preventDefault()
      setActive((current) => Math.max(0, Math.min(flat.length - 1, current + moves[event.key])))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const entry = flat[active]
      if (entry) pick(entry)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  return (
    <div className="page-emoji-picker">
      <input
        type="text"
        className="page-emoji-picker__search"
        placeholder="Search emoji"
        aria-label="Search emoji"
        value={query}
        autoFocus
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {!searching && (
        <div className="page-emoji-picker__tabs" role="tablist" aria-label="Emoji categories">
          {EMOJI_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className={tab === item.id ? 'is-active' : undefined}
              aria-selected={tab === item.id}
              title={item.title}
              aria-label={item.title}
              onClick={() => setTab(item.id)}
            >
              <Icon name={item.icon} size={14} strokeWidth={lucideStrokeForSize(14, 2)} />
            </button>
          ))}
        </div>
      )}
      <div className="page-emoji-picker__body" ref={bodyRef}>
        {!loaded && !failed && <div className="page-emoji-picker__empty">Loading emoji</div>}
        {failed && <div className="page-emoji-picker__empty">Emoji could not be loaded</div>}
        {loaded && flat.length === 0 && (
          <div className="page-emoji-picker__empty">
            {searching ? 'No emoji found' : tab === 'recent' ? 'No recent emoji' : 'No emoji in this category'}
          </div>
        )}
        {sections.map(({ group, entries, start }) => (
          <div key={group}>
            {searching && <div className="page-slash-menu__group">{group}</div>}
            <div className="page-emoji-picker__grid" role="listbox" aria-label={group}>
              {entries.map((entry, offset) => {
                const current = start + offset
                return (
                  <button
                    key={`${group}:${entry.name}`}
                    type="button"
                    role="option"
                    data-index={current}
                    aria-selected={current === active}
                    tabIndex={-1}
                    className={current === active ? 'is-active' : undefined}
                    title={entry.name}
                    aria-label={entry.name}
                    onMouseEnter={() => setActive(current)}
                    onClick={() => pick(entry)}
                  >
                    {applyTone(entry, tone)}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="page-emoji-picker__tone" role="radiogroup" aria-label="Skin tone">
        {([0, 1, 2, 3, 4, 5] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={tone === value}
            aria-label={value === 0 ? 'Default skin tone' : `Skin tone ${value}`}
            className={tone === value ? 'is-active' : undefined}
            onClick={() => {
              setTone(value)
              persistTone(value)
            }}
          >
            {applyTone(TONE_SAMPLE, value)}
          </button>
        ))}
      </div>
    </div>
  )
}
