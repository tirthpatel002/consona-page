import type { BlockAction, PagePlugin } from '../../editor/core'
import { Card, CARD_TONES, type CardTone } from './extensions'
import { insertCard, setCardTone, unwrapCard } from './operations'
import './card.css'

const isCard = (target: { nodeType: string }) => target.nodeType === 'card'

const label: Record<CardTone, string> = { plain: 'Plain', muted: 'Muted', accent: 'Accent' }

const blockActions: readonly BlockAction[] = [
  ...CARD_TONES.map((tone): BlockAction => ({
    id: `card:tone-${tone}`,
    label: `Card style: ${label[tone]}`,
    style: true,
    section: 'Card',
    appliesTo: (target) => isCard(target) && target.node.attrs.tone !== tone,
    run: ({ editor, pos }) => void setCardTone.run(editor, pos, tone),
  })),
  {
    id: 'card:unwrap',
    label: 'Remove card (keep content)',
    section: 'Card',
    appliesTo: isCard,
    run: ({ editor, pos }) => void unwrapCard.run(editor, pos),
  },
]

/** Editor-native card block: a surface that holds any blocks, with three tones. */
export const cardPlugin: PagePlugin = {
  id: 'card',
  extensions: [Card],
  slashItems: [
    {
      id: 'card:insert',
      group: 'Layout',
      title: 'Card',
      keywords: ['card', 'box', 'panel', 'surface'],
      run: (editor) => void insertCard.run(editor),
    },
  ],
  blockActions,
}
