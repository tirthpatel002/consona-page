// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { applyTone, filterEmojis, getEmojis, loadEmojis } from './data'
import { replaceWithEmoji } from './operations'
import { textPlugin } from '../text'
import { emojiPlugin } from './index'

beforeAll(async () => {
  await loadEmojis()
})

const make = (content = '<p></p>') => createTestEditor({ plugins: [textPlugin(), emojiPlugin], content })

const typeText = (
  editor: { view: { dom: HTMLElement }; commands: { insertContent: (c: string) => boolean } },
  text: string,
) => {
  for (const ch of text) editor.commands.insertContent(ch)
}

describe('D1 emoji filtering', () => {
  it('ranks name prefixes first, then keywords', () => {
    const results = filterEmojis('rocket')
    expect(results[0]?.char).toBe('🚀')
    const fire = filterEmojis('fire')
    expect(fire[0]?.char).toBe('🔥') // exact name match beats prefix matches like firefighter
  })

  it('matches keywords and groups', () => {
    expect(filterEmojis('cricket game')[0]?.char).toBe('🏏')
    expect(filterEmojis('hello').some((entry) => entry.char === '👋')).toBe(true)
    expect(filterEmojis('food').length).toBeGreaterThan(10)
  })

  it('empty query returns curated order for browsing; unknown query returns nothing', () => {
    expect(filterEmojis('', 3000).length).toBeGreaterThan(1800)
    // glyphs newer than deployed fonts (e.g. Unicode 15.1+ 'face with bags under eyes') are filtered
    expect(filterEmojis('bags under eyes')).toEqual([])
    expect(filterEmojis('zzzqqq')).toEqual([])
  })
})

describe('D1 ":" suggestion', () => {
  it('inserts the chosen emoji and removes the ":query" text', () => {
    const { editor, destroy } = make('<p>Ship it now</p>')
    editor.commands.setTextSelection(9)
    typeText(editor, ':rocket')
    // active suggestion + ranked items
    const { state } = editor
    const items = filterEmojis('rocket', 12)
    expect(items[0]?.char).toBe('🚀')
    // simulate the suggestion command for the top item
    const $from = state.doc.resolve(state.selection.from)
    const from = $from.pos - ':rocket'.length
    replaceWithEmoji.run(editor, { from, to: state.selection.from }, '🚀')
    expect(editor.state.doc.textContent).toBe('Ship it 🚀now')
    destroy()
  })

  it('a query with no matches leaves the text untouched (times like 12:30)', () => {
    const { editor, destroy } = make('<p>at 12</p>')
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    typeText(editor, ':30')
    // clocks match (as in Notion/Slack), but nothing changes unless the user picks one
    expect(filterEmojis('30').some((entry) => entry.name.includes('thirty'))).toBe(true)
    expect(editor.state.doc.textContent).toBe('at 12:30')
    destroy()
  })

  it('stays out of code blocks', () => {
    const { editor, destroy } = make('<pre><code></code></pre>')
    editor.commands.setTextSelection(2)
    typeText(editor, ':rocket')
    expect(editor.state.doc.textContent).toBe(':rocket')
    destroy()
  })
})

describe('D1 toolbar picker', () => {
  it('registers a main-toolbar item with the emoji icon and a popover', () => {
    const item = emojiPlugin.toolbarItems?.find((t) => t.id === 'emoji:picker')
    expect(item?.placement).toBe('main')
    expect(item?.icon).toBe('emoji')
    expect(typeof item?.popover).toBe('function')
  })
})

describe('D1 recents (Notion "Frequently used")', () => {
  it('records picks most-recent-first and dedupes', async () => {
    const { recentEmojis, recordEmoji } = await import('./recents')
    localStorage.clear()
    const rocket = filterEmojis('rocket')[0]
    const fire = filterEmojis('fire')[0]
    recordEmoji(rocket)
    recordEmoji(fire)
    recordEmoji(rocket)
    const names = recentEmojis().map((entry) => entry.name)
    expect(names[0]).toBe(rocket.name)
    expect(names[1]).toBe(fire.name)
    expect(names).toHaveLength(2)
  })

  it('ignores corrupt storage', async () => {
    const { recentEmojis } = await import('./recents')
    localStorage.setItem('page:emoji-recents', '{broken')
    expect(recentEmojis()).toEqual([])
    localStorage.clear()
  })
})

describe('D1 full coverage (emojibase dataset)', () => {
  it('covers every Notion category including flags', () => {
    const groups = new Set(getEmojis().map((entry) => entry.group))
    for (const group of [
      'Smileys & People',
      'Animals & Nature',
      'Food & Drink',
      'Activity',
      'Travel & Places',
      'Objects',
      'Symbols',
      'Flags',
    ])
      expect(groups.has(group)).toBe(true)
    expect(filterEmojis('flag india')[0]?.char).toBe('🇮🇳')
  })

  it('provides skin-tone variants where the dataset has them', () => {
    const wave = filterEmojis('waving hand')[0]
    expect(applyTone(wave, 0)).toBe('👋')
    expect(applyTone(wave, 3)).toBe('👋🏽')
    // entries without skins fall back to the base char
    const rocket = filterEmojis('rocket')[0]
    expect(applyTone(rocket, 3)).toBe('🚀')
  })
})
