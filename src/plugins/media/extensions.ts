import { mergeAttributes, Node } from '@tiptap/core'
import { isSafeUrl } from '../../editor/core'

export type MediaKind = 'image' | 'video'
export type MediaAlign = 'left' | 'center' | 'right'

export const MEDIA_NODE = 'media'
const ALIGNS: readonly MediaAlign[] = ['left', 'center', 'right']

/** A media source the schema accepts: allowlisted URL schemes only, otherwise empty. */
const safeSrc = (value: unknown): string => (typeof value === 'string' && isSafeUrl(value) ? value : '')

const asAlign = (value: unknown): MediaAlign => ALIGNS.find((a) => a === value) ?? 'center'

/** Image or video with an editable caption. `width` is in px (null = natural, capped to the page width). */
export const Media = Node.create({
  name: MEDIA_NODE,
  group: 'block',
  content: 'inline*',
  isolating: true,
  defining: true,
  draggable: false,
  addAttributes() {
    return {
      kind: {
        default: 'image',
        parseHTML: (el) => (el.getAttribute('data-kind') === 'video' ? 'video' : 'image'),
      },
      src: {
        default: '',
        parseHTML: (el) => safeSrc(el.querySelector('img, video')?.getAttribute('src')),
      },
      width: {
        default: null,
        parseHTML: (el) => Number(el.getAttribute('data-width')) || null,
      },
      align: {
        default: 'center',
        parseHTML: (el) => asAlign(el.getAttribute('data-align')),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'figure[data-type="media"]', contentElement: 'figcaption' }]
  },
  renderHTML({ node }) {
    const { kind, width, align } = node.attrs
    const src = safeSrc(node.attrs.src)
    const width_ = typeof width === 'number' && width > 0 ? width : null
    const frame =
      kind === 'video'
        ? ['video', { src: String(src), controls: '', preload: 'metadata' }]
        : ['img', { src: String(src), alt: '', draggable: 'false' }]
    return [
      'figure',
      mergeAttributes(
        { 'data-type': 'media', 'data-kind': String(kind), 'data-align': asAlign(align), class: 'page-media' },
        width_ ? { 'data-width': String(width_), style: `width: ${width_}px` } : {},
      ),
      [
        'div',
        { class: 'page-media__frame', contenteditable: 'false' },
        frame,
        ['span', { class: 'page-media__resize' }],
      ],
      ['figcaption', { class: 'page-media__caption' }, 0],
    ]
  },
})
