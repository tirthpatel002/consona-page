import { mergeAttributes, Node } from '@tiptap/core'
import { DOMSerializer } from '@tiptap/pm/model'
import {
  asFocus,
  asKind,
  asShape,
  asZoom,
  embedOriginal,
  formatBytes,
  isSafeLink,
  isSafeMediaSrc,
  type MediaKind,
} from './sources'

export type { MediaKind } from './sources'
export type MediaAlign = 'left' | 'center' | 'right'

export const MEDIA_NODE = 'media'
export const MEDIA_TOOLBAR_SLOT = 'data-media-toolbar-slot'
const ALIGNS: readonly MediaAlign[] = ['left', 'center', 'right']

export const asAlign = (value: unknown): MediaAlign => ALIGNS.find((a) => a === value) ?? 'center'
const asText = (value: unknown, max = 500): string => (typeof value === 'string' ? value.slice(0, max) : '')
const asSize = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null

const num = (el: Element, name: string): number | null => {
  const value = Number(el.getAttribute(name))
  return el.hasAttribute(name) && Number.isFinite(value) ? value : null
}

/** The element inside a parsed figure that carries the source for this kind. */
function sourceOf(el: Element, kind: MediaKind): string {
  if (kind === 'embed') return el.getAttribute('data-src') ?? ''
  if (kind === 'bookmark') return el.querySelector('a.page-media__bookmark')?.getAttribute('href') ?? ''
  if (kind === 'file') return el.querySelector('a[download], a[href]')?.getAttribute('href') ?? ''
  return el.querySelector(kind === 'image' ? 'img' : kind)?.getAttribute('src') ?? ''
}

const extOf = (name: string) => (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] ?? 'file').toUpperCase()

/**
 * Image, video, audio, file or embedded video with an editable caption. `width` is in px (null = natural,
 * capped to the page width); `full` fills the available width. Every source is checked against the
 * allowlist for its kind when parsed and again when rendered.
 */
export const Media = Node.create({
  name: MEDIA_NODE,
  group: 'block',
  content: 'inline*',
  isolating: true,
  defining: true,
  draggable: false,
  // The media bar is this block's toolbar; the text bubble must not appear over it (see core BubbleToolbar).
  extendNodeSchema: (extension) => ({ bubbleless: extension.name === MEDIA_NODE }),
  addAttributes() {
    const attr = (_name: string, fallback: unknown, parse: (el: HTMLElement) => unknown) => ({
      default: fallback,
      parseHTML: parse,
      rendered: false,
    })
    return {
      kind: attr('kind', 'image', (el) => asKind(el.getAttribute('data-kind'))),
      src: attr('src', '', (el) => {
        const kind = asKind(el.getAttribute('data-kind'))
        const src = sourceOf(el, kind)
        return isSafeMediaSrc(kind, src) ? src : ''
      }),
      width: attr('width', null, (el) => Number(el.getAttribute('data-width')) || null),
      align: attr('align', 'center', (el) => asAlign(el.getAttribute('data-align'))),
      alt: attr('alt', '', (el) => asText(el.getAttribute('data-alt'), 300)),
      showCaption: attr('showCaption', true, (el) => el.getAttribute('data-caption') !== 'off'),
      link: attr('link', '', (el) => {
        const href = el.getAttribute('data-link') ?? ''
        return isSafeLink(href) ? href : ''
      }),
      shape: attr('shape', 'none', (el) => asShape(el.getAttribute('data-shape'))),
      zoom: attr('zoom', 1, (el) => asZoom(num(el, 'data-zoom'))),
      focusX: attr('focusX', 50, (el) => asFocus(num(el, 'data-focus-x'))),
      focusY: attr('focusY', 50, (el) => asFocus(num(el, 'data-focus-y'))),
      full: attr('full', false, (el) => el.getAttribute('data-full') === 'true'),
      name: attr('name', '', (el) => asText(el.getAttribute('data-name'), 200)),
      size: attr('size', null, (el) => asSize(num(el, 'data-size'))),
    }
  },
  parseHTML() {
    return [{ tag: 'figure[data-type="media"]', contentElement: 'figcaption' }]
  },
  // A node view so the React toolbar portal inside the slot is not treated as a document change, and so an
  // attribute change patches the block in place: the slot, the caption and the toolbar portal stay put.
  addNodeView() {
    return ({ node: initial, HTMLAttributes }) => {
      let current = initial
      const render = (node: typeof initial) => {
        const spec = this.type.spec.toDOM?.(node) ?? ['figure', HTMLAttributes, 0]
        return DOMSerializer.renderSpec(document, spec)
      }
      const { dom, contentDOM } = render(current)
      return {
        dom,
        contentDOM,
        update: (next) => {
          if (next.type !== current.type) return false
          current = next
          const fresh = render(next).dom as HTMLElement
          const figure = dom as HTMLElement
          const keep = [...figure.classList].filter((name) => name.startsWith('ProseMirror-'))
          for (const attr of [...figure.attributes]) figure.removeAttribute(attr.name)
          for (const attr of [...fresh.attributes]) figure.setAttribute(attr.name, attr.value)
          figure.classList.add(...keep)
          const frame = figure.querySelector('.page-media__frame')
          const freshFrame = fresh.querySelector('.page-media__frame')
          if (frame && freshFrame) frame.replaceWith(freshFrame)
          return true
        },
        ignoreMutation: (mutation) => {
          if (mutation.type === 'selection') return false
          const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement
          return target?.closest(`[${MEDIA_TOOLBAR_SLOT}]`) !== null && target !== null
        },
        stopEvent: (event) =>
          event.target instanceof Element &&
          (event.target.closest(`[${MEDIA_TOOLBAR_SLOT}]`) !== null ||
            // Players, the link chip and the alt badge handle their own presses and keys.
            (event.target.closest('audio, video, iframe, a, .page-media__alt') !== null &&
              event.target.closest('figcaption') === null)),
      }
    }
  },
  renderHTML({ node }) {
    const kind = asKind(node.attrs.kind)
    const src = isSafeMediaSrc(kind, node.attrs.src) ? node.attrs.src.trim() : ''
    const width = typeof node.attrs.width === 'number' && node.attrs.width > 0 ? node.attrs.width : null
    const full = node.attrs.full === true
    const alt = asText(node.attrs.alt, 300)
    const link = isSafeLink(node.attrs.link) ? node.attrs.link.trim() : ''
    const name = asText(node.attrs.name, 200)
    const size = asSize(node.attrs.size)
    const shape = asShape(node.attrs.shape)
    const zoom = asZoom(node.attrs.zoom)
    const fx = asFocus(node.attrs.focusX)
    const fy = asFocus(node.attrs.focusY)
    const captionOn = node.attrs.showCaption !== false

    let frame: unknown[]
    if (kind === 'video') frame = ['video', { src, controls: '', preload: 'metadata' }]
    else if (kind === 'audio') frame = ['audio', { src, controls: '', preload: 'metadata' }]
    else if (kind === 'embed') {
      frame = [
        'iframe',
        {
          src,
          title: alt || 'Embedded video',
          sandbox: 'allow-scripts allow-same-origin allow-presentation',
          allow: 'fullscreen; picture-in-picture',
          allowfullscreen: '',
          referrerpolicy: 'strict-origin-when-cross-origin',
          loading: 'lazy',
          tabindex: '0',
        },
      ]
    } else if (kind === 'bookmark') {
      let host = src
      try {
        host = new URL(src).hostname.replace(/^www\./, '')
      } catch {
        /* keep the raw address */
      }
      frame = [
        'a',
        { class: 'page-media__bookmark', href: src, target: '_blank', rel: 'noopener noreferrer', title: src },
        ['span', { class: 'page-media__bookmark-title' }, name || host],
        ['span', { class: 'page-media__bookmark-url' }, src.replace(/^https?:\/\//i, '').slice(0, 80)],
      ]
    } else if (kind === 'file') {
      frame = [
        'div',
        { class: 'page-media__file', 'data-ext': extOf(name || src.split('?')[0]) },
        ['span', { class: 'page-media__file-type' }, extOf(name || src.split('?')[0])],
        ['span', { class: 'page-media__file-name' }, name || 'File'],
        ['span', { class: 'page-media__file-size' }, formatBytes(size)],
      ]
    } else {
      frame = [
        'img',
        {
          src,
          alt,
          draggable: 'false',
          style: `--media-zoom: ${zoom}; --media-x: ${fx}%; --media-y: ${fy}%`,
        },
      ]
    }

    const chips: unknown[] = []
    if (kind === 'image' && alt) {
      chips.push([
        'span',
        { class: 'page-media__alt', tabindex: '0', role: 'note', 'aria-label': `Alt text: ${alt}` },
        ['b', {}, 'ALT'],
        ['i', {}, alt],
      ])
    }
    if (kind === 'image' && link) {
      chips.push([
        'a',
        { class: 'page-media__link', href: link, target: '_blank', rel: 'noopener noreferrer', title: link },
        link
          .replace(/^https?:\/\//i, '')
          .replace(/^mailto:/i, '')
          .slice(0, 40),
      ])
    }

    const attrs: Record<string, string> = {
      'data-type': 'media',
      'data-kind': kind,
      'data-align': asAlign(node.attrs.align),
      'data-caption': captionOn ? 'on' : 'off',
      class: 'page-media',
    }
    if (width && !full) {
      attrs['data-width'] = String(width)
      attrs.style = `width: ${width}px`
    }
    if (full) attrs['data-full'] = 'true'
    if (alt) attrs['data-alt'] = alt
    if (link) attrs['data-link'] = link
    if (kind === 'image' && shape !== 'none') attrs['data-shape'] = shape
    if (kind === 'image' && zoom !== 1) attrs['data-zoom'] = String(zoom)
    if (kind === 'image' && fx !== 50) attrs['data-focus-x'] = String(fx)
    if (kind === 'image' && fy !== 50) attrs['data-focus-y'] = String(fy)
    if (kind === 'embed') attrs['data-src'] = src
    if (kind === 'embed') attrs['data-original'] = embedOriginal(src)
    if (name) attrs['data-name'] = name
    if (typeof node.attrs.commentThread === 'string' && node.attrs.commentThread) {
      attrs['data-comment-thread'] = node.attrs.commentThread
    }
    if (size !== null) attrs['data-size'] = String(size)

    const handle = (edge: 'left' | 'right') => [
      'span',
      {
        class: 'page-media__resize',
        'data-edge': edge,
        role: 'button',
        tabindex: '0',
        'aria-label': `Resize from the ${edge} edge (arrow keys change the width)`,
      },
    ]
    const resizable = kind !== 'audio' && kind !== 'file'
    return [
      'figure',
      mergeAttributes(attrs),
      ['div', { class: 'page-media__toolbar-slot', contenteditable: 'false', [MEDIA_TOOLBAR_SLOT]: '' }],
      [
        'div',
        { class: 'page-media__frame', contenteditable: 'false' },
        frame,
        ...chips,
        ...(resizable ? [handle('left'), handle('right')] : []),
      ],
      ['figcaption', { class: 'page-media__caption' }, 0],
    ]
  },
})
