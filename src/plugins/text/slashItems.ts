import type { SlashItem } from '../../editor/core'
import {
  insertDivider,
  setHeading,
  setParagraph,
  setToggle,
  setToggleHeading,
  toggleBlockquote,
  toggleBulletList,
  toggleCodeBlock,
  toggleOrderedList,
} from './operations'

const GROUP = 'Text'

export const textSlashItems: readonly SlashItem[] = [
  {
    id: 'text:paragraph',
    group: GROUP,
    title: 'Text',
    keywords: ['paragraph', 'p'],
    run: (e) => void setParagraph.run(e),
  },
  {
    id: 'text:heading-1',
    group: GROUP,
    title: 'Heading 1',
    keywords: ['h1', 'title'],
    run: (e) => void setHeading.run(e, 1),
  },
  {
    id: 'text:heading-2',
    group: GROUP,
    title: 'Heading 2',
    keywords: ['h2'],
    run: (e) => void setHeading.run(e, 2),
  },
  {
    id: 'text:heading-3',
    group: GROUP,
    title: 'Heading 3',
    keywords: ['h3'],
    run: (e) => void setHeading.run(e, 3),
  },
  {
    id: 'text:bullet-list',
    group: GROUP,
    title: 'Bulleted list',
    keywords: ['ul', 'unordered'],
    run: (e) => void toggleBulletList.run(e),
  },
  {
    id: 'text:ordered-list',
    group: GROUP,
    title: 'Numbered list',
    keywords: ['ol', 'ordered'],
    run: (e) => void toggleOrderedList.run(e),
  },
  {
    id: 'text:toggle',
    group: GROUP,
    title: 'Toggle',
    keywords: ['collapse', 'details', 'accordion'],
    run: (e) => void setToggle.run(e),
  },
  ...([1, 2, 3] as const).map((level) => ({
    id: `text:toggle-heading-${level}`,
    group: GROUP,
    title: `Toggle heading ${level}`,
    keywords: ['collapse', 'toggle', 'heading', `h${level}`],
    run: (e: Parameters<typeof setToggleHeading.run>[0]) => void setToggleHeading.run(e, level),
  })),
  {
    id: 'text:code',
    group: GROUP,
    title: 'Code',
    keywords: ['code block', 'snippet', 'pre'],
    run: (e) => void toggleCodeBlock.run(e),
  },
  {
    id: 'text:quote',
    group: GROUP,
    title: 'Quote',
    keywords: ['blockquote'],
    run: (e) => void toggleBlockquote.run(e),
  },
  {
    id: 'text:divider',
    group: GROUP,
    title: 'Divider',
    keywords: ['hr', 'rule', 'separator'],
    run: (e) => void insertDivider.run(e),
  },
]
