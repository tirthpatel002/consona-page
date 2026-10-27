import type { BlockAction, PagePlugin, SlashItem } from '../../editor/core'
import { insertFiles, mediaWarning, MediaBehavior } from './behavior'
import { Media, MEDIA_NODE, type MediaAlign, type MediaKind } from './extensions'
import { chooseFile, kindOfUrl } from './files'
import { insertMedia, setMediaLayout, setMediaSource } from './operations'
import { mediaToolbar } from './mediaToolbar'
import './media.css'

const GROUP = 'Media'

const pickAndInsert =
  (kind: MediaKind): SlashItem['run'] =>
  (editor) => {
    void chooseFile(kind).then((file) => {
      if (file) void insertFiles(editor, [file], undefined, mediaWarning)
    })
  }

const fromLink =
  (kind: MediaKind): SlashItem['run'] =>
  (editor) => {
    const url = window.prompt(`${kind === 'image' ? 'Image' : 'Video'} link (https://...)`)?.trim()
    if (!url || !/^https?:\/\//i.test(url)) return
    insertMedia.run(editor, kindOfUrl(url) ?? kind, url)
  }

const slashItems: readonly SlashItem[] = [
  {
    id: 'media:image',
    group: GROUP,
    title: 'Image',
    keywords: ['image', 'picture', 'photo', 'upload'],
    run: pickAndInsert('image'),
  },
  {
    id: 'media:video',
    group: GROUP,
    title: 'Video',
    keywords: ['video', 'movie', 'upload'],
    run: pickAndInsert('video'),
  },
  {
    id: 'media:image-link',
    group: GROUP,
    title: 'Image from link',
    keywords: ['image', 'url', 'link'],
    run: fromLink('image'),
  },
  {
    id: 'media:video-link',
    group: GROUP,
    title: 'Video from link',
    keywords: ['video', 'url', 'link'],
    run: fromLink('video'),
  },
]

const isMedia = (target: { nodeType: string }) => target.nodeType === MEDIA_NODE

const align = (value: MediaAlign, label: string): BlockAction => ({
  id: `media:align-${value}`,
  label,
  style: true,
  section: 'Media',
  appliesTo: (target) => isMedia(target) && target.node.attrs.align !== value,
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
    appliesTo: (target) => isMedia(target) && target.node.attrs.width !== null,
    run: ({ editor, pos }) => void setMediaLayout.run(editor, pos, { width: null }),
  },
  {
    id: 'media:replace',
    label: 'Replace with link',
    section: 'Media',
    appliesTo: isMedia,
    run: ({ editor, pos }) => {
      const url = window.prompt('New link (https://...)')?.trim()
      if (url && /^https?:\/\//i.test(url)) setMediaSource.run(editor, pos, url)
    },
  },
]

/** Images and videos: a native block with a caption, upload/drop/paste/link insertion, resize and alignment. */
export const mediaPlugin: PagePlugin = {
  id: 'media',
  extensions: [Media, MediaBehavior],
  slashItems,
  blockActions,
  blockToolbars: [mediaToolbar],
}
