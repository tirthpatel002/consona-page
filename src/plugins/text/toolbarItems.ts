import type { ToolbarItem } from '../../editor/core'
import { toggleBulletList } from './operations'

/** List toggles stay on the main toolbar; headings/quote/code live in slash + turn-into. */
export const textToolbarItems: readonly ToolbarItem[] = [
  {
    id: 'text:bullet-list',
    group: 'lists',
    label: 'Bulleted list',
    title: 'Bulleted list',
    icon: 'bullet-list',
    isActive: (editor) => editor.isActive('bulletList'),
    run: (editor) => void toggleBulletList.run(editor),
  },
]
