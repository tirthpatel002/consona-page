import type { ToolbarItem } from '../../editor/core'
import { toggleBlockquote, toggleBulletList, toggleCodeBlock, toggleHeading } from './operations'

export const textToolbarItems: readonly ToolbarItem[] = [
  {
    id: 'text:h1',
    group: 'heading',
    label: 'H1',
    title: 'Heading 1',
    icon: 'h1',
    isActive: (editor) => editor.isActive('heading', { level: 1 }),
    run: (editor) => void toggleHeading.run(editor, 1),
  },
  {
    id: 'text:h2',
    group: 'heading',
    label: 'H2',
    title: 'Heading 2',
    icon: 'h2',
    isActive: (editor) => editor.isActive('heading', { level: 2 }),
    run: (editor) => void toggleHeading.run(editor, 2),
  },
  {
    id: 'text:bullet-list',
    group: 'lists',
    label: 'Bulleted list',
    title: 'Bulleted list',
    icon: 'bullet-list',
    isActive: (editor) => editor.isActive('bulletList'),
    run: (editor) => void toggleBulletList.run(editor),
  },
  {
    id: 'text:quote',
    group: 'blocks',
    label: 'Quote',
    title: 'Quote',
    icon: 'quote',
    isActive: (editor) => editor.isActive('blockquote'),
    run: (editor) => void toggleBlockquote.run(editor),
  },
  {
    id: 'text:code-block',
    group: 'blocks',
    label: 'Code block',
    title: 'Code block',
    icon: 'code-block',
    isActive: (editor) => editor.isActive('codeBlock'),
    run: (editor) => void toggleCodeBlock.run(editor),
  },
]
