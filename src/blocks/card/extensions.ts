import { mergeAttributes, Node } from '@tiptap/core'

export const CARD_TONES = ['plain', 'muted', 'accent'] as const
export type CardTone = (typeof CARD_TONES)[number]

const asTone = (value: unknown): CardTone => CARD_TONES.find((tone) => tone === value) ?? 'plain'

/** Editor-native card: a bordered surface holding ordinary blocks (text, lists, media, ...). */
export const Card = Node.create({
  name: 'card',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      tone: {
        default: 'plain',
        parseHTML: (element) => asTone(element.getAttribute('data-tone')),
        renderHTML: (attrs) => ({ 'data-tone': asTone(attrs.tone) }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="card"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'card',
        'data-block-feedback': 'shell',
        class: 'page-card page-block__shell',
      }),
      0,
    ]
  },
})
