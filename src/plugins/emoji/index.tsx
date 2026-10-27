import type { PagePlugin } from '../../editor/core'
import { EmojiMenu } from './EmojiMenu'
import { EmojiPicker } from './EmojiPicker'
import { createEmojiSuggestion } from './emojiSuggestion'
import { EmojiStore } from './store'

const store = new EmojiStore()

/** D1: emoji picker - inline ":" completion plus a searchable toolbar picker. */
export const emojiPlugin: PagePlugin = {
  id: 'emoji',
  extensions: [createEmojiSuggestion(store)],
  toolbarItems: [
    {
      id: 'emoji:picker',
      group: 'insert',
      label: 'Emoji',
      title: 'Insert emoji',
      icon: 'emoji',
      placement: 'main',
      popover: ({ editor, close }) => <EmojiPicker editor={editor} close={close} />,
    },
  ],
  overlays: [{ id: 'emoji:menu', render: () => <EmojiMenu store={store} /> }],
}
