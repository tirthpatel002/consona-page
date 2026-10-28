import { BackgroundColor, Color, TextStyle } from '@tiptap/extension-text-style'
import { ColorPicker, type PagePlugin, type ToolbarItem } from '../../editor/core'
import { toggleMark } from '../../editor/core'
import { BACKGROUND_COLORS, TEXT_COLORS } from './colors'
import { LinkForm } from './LinkForm'
import { linkClickExtension } from './linkClick'
import { linkTooltip } from './linkTooltip'
import { setBackgroundColor, setTextColor } from './operations'

const markItem = (
  mark: string,
  label: string,
  icon: 'bold' | 'italic' | 'underline' | 'strike' | 'code',
  shortcut?: string,
): ToolbarItem => ({
  id: `formatting:${mark}`,
  group: 'marks',
  label,
  title: shortcut ? `${label} (${shortcut.replace('Mod', '⌘').replace('Shift', '⇧').replaceAll('-', '')})` : label,
  icon,
  placement: 'bubble',
  isActive: (editor) => editor.isActive(mark),
  run: (editor) => void toggleMark.run(editor, mark),
})

const bubbleItems: readonly ToolbarItem[] = [
  markItem('bold', 'Bold', 'bold'),
  markItem('italic', 'Italic', 'italic'),
  markItem('underline', 'Underline', 'underline', 'Mod-u'),
  markItem('strike', 'Strikethrough', 'strike'),
  markItem('code', 'Inline code', 'code'),
  {
    id: 'formatting:link',
    group: 'link',
    label: 'Link',
    title: 'Link',
    icon: 'link',
    placement: 'bubble',
    isActive: (editor) => editor.isActive('link'),
    popover: ({ editor, close }) => <LinkForm editor={editor} close={close} />,
  },
  {
    id: 'formatting:colors',
    group: 'color',
    label: 'Colour',
    title: 'Text and highlight colour',
    icon: 'color',
    placement: 'bubble',
    isActive: (editor) =>
      Boolean(editor.getAttributes('textStyle').color || editor.getAttributes('textStyle').backgroundColor),
    popover: ({ editor, close }) => (
      <div className="page-colors-panel">
        <span className="page-colors-panel__title">Text colour</span>
        <ColorPicker
          label="Text colour"
          colors={TEXT_COLORS}
          current={(editor.getAttributes('textStyle').color as string | undefined) ?? null}
          onPick={(value) => {
            setTextColor.run(editor, value)
            close()
          }}
        />
        <span className="page-colors-panel__title">Highlight</span>
        <ColorPicker
          label="Highlight colour"
          colors={BACKGROUND_COLORS}
          current={(editor.getAttributes('textStyle').backgroundColor as string | undefined) ?? null}
          onPick={(value) => {
            setBackgroundColor.run(editor, value)
            close()
          }}
        />
      </div>
    ),
  },
]

/** Bubble toolbar over selected text: marks, text/highlight colours and links (popover form + ⌘K). */
export const formattingPlugin: PagePlugin = {
  id: 'formatting',
  extensions: [TextStyle, Color, BackgroundColor, linkClickExtension, linkTooltip],
  toolbarItems: bubbleItems,
}
