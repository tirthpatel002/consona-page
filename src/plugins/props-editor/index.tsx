import type { PagePlugin } from '../../editor/core'
import { PropsEditorPanel } from './PropsEditorPanel'
import './props-editor.css'

export const PROPS_EDITOR_PANEL = 'props-editor'

/** Raw props editing for every block (fallback for anything without inline editing). */
export const propsEditorPlugin: PagePlugin = {
  id: 'props-editor',
  panels: [
    {
      id: PROPS_EDITOR_PANEL,
      label: 'Props',
      icon: 'sliders',
      render: (editor) => <PropsEditorPanel editor={editor} />,
    },
  ],
  blockActions: [
    {
      id: 'block:edit-props',
      label: 'Edit props…',
      appliesTo: (target) => target.isEmbed,
      run: ({ editor, pos, openPanel }) => {
        editor.chain().setNodeSelection(pos).run()
        openPanel(PROPS_EDITOR_PANEL)
      },
    },
  ],
}
