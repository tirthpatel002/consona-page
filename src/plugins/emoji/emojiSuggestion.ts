import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import { applyTone, filterEmojis, loadEmojis, selectedTone, type EmojiEntry } from './data'
import { replaceWithEmoji } from './operations'
import { recordEmoji } from './recents'
import type { EmojiStore } from './store'

export const emojiSuggestionKey = new PluginKey('emojiSuggestion')

const MAX_SUGGESTIONS = 12

/**
 * Inline ":name" emoji completion. Typing ":" followed by letters opens a ranked menu; choosing an
 * entry replaces the ":query" text with the emoji. Ignored inside code blocks, and stays closed
 * while the query is empty or has no matches.
 */
export function createEmojiSuggestion(store: EmojiStore) {
  return Extension.create({
    name: 'emojiSuggestion',
    addProseMirrorPlugins() {
      return [
        Suggestion<EmojiEntry, EmojiEntry>({
          editor: this.editor,
          pluginKey: emojiSuggestionKey,
          char: ':',
          // Only excluded inside code blocks; a query with no matches keeps the menu closed,
          // so times like "12:30" never show UI and keys pass through.
          allow: ({ state, range }) => state.doc.resolve(range.from).parent.type.name !== 'codeBlock',
          items: async ({ query }) =>
            query.length === 0 ? [] : [...(await loadEmojis(), filterEmojis(query, MAX_SUGGESTIONS))],
          command: ({ editor, range, props: entry }) => {
            recordEmoji(entry)
            replaceWithEmoji.run(editor, { from: range.from, to: range.to }, applyTone(entry, selectedTone()))
          },
          render: () => {
            // The menu opens only once there is at least one match; an empty result keeps it
            // closed so typing like "12:30" shows nothing and keys pass through.
            const sync = (items: readonly EmojiEntry[], rect: DOMRect | null, command: (e: EmojiEntry) => void) =>
              items.length > 0 ? store.show(items, rect, command) : store.close()
            return {
              onStart: (props) => sync(props.items, props.clientRect?.() ?? null, props.command),
              onUpdate: (props) => sync(props.items, props.clientRect?.() ?? null, props.command),
              onKeyDown: ({ event }) => store.handleKey(event),
              onExit: () => store.close(),
            }
          },
        }),
      ]
    },
  })
}
