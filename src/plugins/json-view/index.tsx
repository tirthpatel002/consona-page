import type { PagePlugin } from '../../editor/core'
import { JsonPanel } from './JsonPanel'
import './json-view.css'

/** Live `editor.getJSON()` inspector panel. */
export const jsonViewPlugin: PagePlugin = {
  id: 'json-view',
  panels: [{ id: 'json-view', label: 'JSON', icon: 'braces', render: (editor) => <JsonPanel editor={editor} /> }],
}
