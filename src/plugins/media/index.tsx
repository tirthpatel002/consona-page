import type { BlockAction, PagePlugin, SlashItem } from '../../editor/core'
import { MediaBehavior } from './behavior'
import { Media, MEDIA_NODE, type MediaAlign } from './extensions'
import { setMediaHost, type MediaHost } from './host'
import { MediaOverlay } from './MediaOverlay'
import { mediaToolbars } from './mediaToolbar'
import { setMediaLayout } from './operations'
import { openPanel } from './panelStore'
import type { MediaKind } from './sources'
import './media.css'

const GROUP = 'Media'

const insertItem = (kind: MediaKind, title: string, keywords: string[], tab: 'upload' | 'link'): SlashItem => ({
  id: tab === 'upload' ? `media:${kind}` : `media:${kind}-link`,
  group: GROUP,
  title,
  keywords,
  run: (editor) => openPanel(editor, { type: 'insert', kind, tab }),
})

const slashItems: readonly SlashItem[] = [
  insertItem('image', 'Image', ['image', 'picture', 'photo', 'upload'], 'upload'),
  insertItem('video', 'Video', ['video', 'movie', 'upload', 'youtube', 'vimeo', 'embed'], 'upload'),
  insertItem('audio', 'Audio', ['audio', 'music', 'sound', 'podcast', 'upload'], 'upload'),
  insertItem('file', 'File', ['file', 'attachment', 'document', 'pdf', 'upload'], 'upload'),
  insertItem('bookmark', 'Bookmark', ['bookmark', 'link', 'url', 'website', 'card'], 'link'),
  insertItem('image', 'Image from link', ['image', 'url', 'link'], 'link'),
  insertItem('video', 'Video from link', ['video', 'url', 'link', 'youtube', 'vimeo', 'embed'], 'link'),
  insertItem('audio', 'Audio from link', ['audio', 'url', 'link'], 'link'),
  insertItem('file', 'File from link', ['file', 'url', 'link'], 'link'),
]

const isMedia = (target: { nodeType: string }) => target.nodeType === MEDIA_NODE

const align = (value: MediaAlign, label: string): BlockAction => ({
  id: `media:align-${value}`,
  label,
  style: true,
  section: 'Media',
  appliesTo: (target) =>
    isMedia(target) &&
    ['image', 'video', 'embed'].includes(String(target.node.attrs.kind)) &&
    target.node.attrs.align !== value,
  run: ({ editor, pos }) => void setMediaLayout.run(editor, pos, { align: value }),
})

const blockActions: readonly BlockAction[] = [
  align('left', 'Align left'),
  align('center', 'Align center'),
  align('right', 'Align right'),
  {
    id: 'media:reset-size',
    label: 'Reset size',
    section: 'Media',
    appliesTo: (target) => isMedia(target) && (target.node.attrs.width !== null || target.node.attrs.full === true),
    run: ({ editor, pos }) => void setMediaLayout.run(editor, pos, { width: null, full: false }),
  },
  {
    id: 'media:replace',
    label: 'Replace',
    section: 'Media',
    appliesTo: isMedia,
    run: ({ editor, pos, node }) =>
      openPanel(editor, { type: 'replace', pos, kind: node.attrs.kind as MediaKind, tab: 'upload' }),
  },
]

/**
 * Images, video, audio, files and embedded video: one native block with an optional caption, an insert
 * panel (upload or link), paste/drop, resize, alignment, crop, alt text, link and a contextual bar.
 */
const buildPlugin = (): PagePlugin => ({
  id: 'media',
  extensions: [Media, MediaBehavior],
  slashItems,
  blockActions,
  blockToolbars: mediaToolbars,
  overlays: [{ id: 'media:panels', render: () => <MediaOverlay /> }],
})

/** The media plugin with no file store: uploads stay inline in the document (data URLs). */
export const mediaPlugin: PagePlugin = buildPlugin()

/**
 * The media plugin wired to a host file store. Uploads then go to `blobs` and the block keeps a `blob:<id>`
 * reference; a refused file shows its limit and inserts nothing. One host per page of the app.
 */
export function createMediaPlugin(host: MediaHost = {}): PagePlugin {
  setMediaHost(host)
  return buildPlugin()
}
export { migrateInlineMedia, type MigrationKept, type MigrationResult } from './migrate'
