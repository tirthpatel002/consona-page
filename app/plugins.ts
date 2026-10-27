import type { PagePlugin } from '../src/editor/core'
import {
  breadcrumbPlugin,
  calloutPlugin,
  cardPlugin,
  equationPlugin,
  mermaidPlugin,
  tablePlugin,
  tabsPlugin,
  togglePlugin,
} from '../src/blocks'
import { blockSelectionPlugin } from '../src/plugins/block-selection'
import { commentsPlugin } from '../src/plugins/comments'
import { createPersistencePlugin } from '../src/plugins/persistence'
import { demoBlobs, demoDocumentId, demoSession } from './demoSession'
import { emojiPlugin } from '../src/plugins/emoji'
import { blockActionsPlugin } from '../src/plugins/block-actions'
import { jsonViewPlugin } from '../src/plugins/json-view'
import { propsEditorPlugin } from '../src/plugins/props-editor'
import { formattingPlugin } from '../src/plugins/formatting'
import { columnsPlugin } from '../src/plugins/columns'
import { exportPlugin } from '../src/plugins/export'
import { createMediaPlugin, inlineStoredFiles } from '../src/plugins/media'
import { setExportHost } from '../src/plugins/export/host'
import { showExportOmitted } from './exportNotice'
import { listsPlugin } from '../src/plugins/lists'
import { textPlugin } from '../src/plugins/text'

setExportHost({
  prepare: (doc) => inlineStoredFiles(doc, demoBlobs),
  onOmitted: showExportOmitted,
})

/** The page's plugin list. Order = toolbar / slash-menu order. Add new plugins here. */
export const pagePlugins: readonly PagePlugin[] = [
  textPlugin(),
  formattingPlugin,
  listsPlugin,
  columnsPlugin,
  exportPlugin,
  createMediaPlugin({ blobs: demoBlobs, pageId: () => demoDocumentId }),
  blockActionsPlugin,
  blockSelectionPlugin,
  emojiPlugin,
  commentsPlugin,
  createPersistencePlugin(demoSession),
  breadcrumbPlugin,
  calloutPlugin,
  equationPlugin,
  mermaidPlugin,
  tabsPlugin,
  togglePlugin,
  cardPlugin,
  tablePlugin,
  propsEditorPlugin,
  jsonViewPlugin,
]
