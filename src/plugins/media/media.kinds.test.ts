// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { fromHtml, toHtml } from '../export/html'
import { fromMarkdown, toMarkdown } from '../export/markdown'
import { sanitizeImported } from '../export/safeUrls'
import type { Doc } from '../export/types'
import { textPlugin } from '../text'
import { mediaPlugin } from './index'
import { fileBlockMime, kindOfAny, kindOfFile, kindOfUrl, readAsDataUrl } from './files'
import { insertMedia, setMediaDetails, setMediaLayout, setMediaSource } from './operations'
import { embedOriginal, isSafeLink, isSafeMediaSrc, parseEmbedUrl } from './sources'
import { findSelectedMedia, mediaToolbars } from './mediaToolbar'
import { nextWidth } from './behavior'

import { commentsPlugin } from '../comments'
const make = (content = '<p>keep</p>') =>
  createTestEditor({ plugins: [textPlugin(), mediaPlugin, commentsPlugin], content })
const mediaNode = (editor: ReturnType<typeof make>['editor']) => {
  let found: { attrs: Record<string, unknown>; pos: number; textContent: string } | null = null
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'media') found = { attrs: node.attrs, pos, textContent: node.textContent }
  })
  if (!found) throw new Error('no media block')
  return found as { attrs: Record<string, unknown>; pos: number; textContent: string }
}

describe('source allowlists per kind', () => {
  it('accepts only matching data types and http(s)/relative links', () => {
    expect(isSafeMediaSrc('image', 'data:image/png;base64,AAAA')).toBe(true)
    expect(isSafeMediaSrc('image', 'data:image/svg+xml;base64,AAAA')).toBe(false)
    expect(isSafeMediaSrc('image', 'data:text/html;base64,AAAA')).toBe(false)
    expect(isSafeMediaSrc('image', 'javascript:alert(1)')).toBe(false)
    expect(isSafeMediaSrc('image', 'mailto:a@b.c')).toBe(false)
    expect(isSafeMediaSrc('audio', 'data:audio/mpeg;base64,AAAA')).toBe(true)
    expect(isSafeMediaSrc('audio', 'data:video/mp4;base64,AAAA')).toBe(false)
    expect(isSafeMediaSrc('file', 'data:application/pdf;base64,AAAA')).toBe(true)
    expect(isSafeMediaSrc('file', 'data:text/html;base64,AAAA')).toBe(false)
    expect(isSafeMediaSrc('file', 'data:image/svg+xml;base64,AAAA')).toBe(false)
    expect(isSafeMediaSrc('video', 'https://x.test/a.mp4')).toBe(true)
    expect(isSafeMediaSrc('video', '/local/a.mp4')).toBe(true)
  })

  it('embeds are only the canonical YouTube and Vimeo players', () => {
    expect(isSafeMediaSrc('embed', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(true)
    expect(isSafeMediaSrc('embed', 'https://player.vimeo.com/video/123456')).toBe(true)
    expect(isSafeMediaSrc('embed', 'https://evil.test/embed/dQw4w9WgXcQ')).toBe(false)
    expect(isSafeMediaSrc('embed', 'https://www.youtube-nocookie.com.evil.test/embed/dQw4w9WgXcQ')).toBe(false)
    expect(isSafeMediaSrc('embed', 'javascript:alert(1)')).toBe(false)
    expect(parseEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=3')?.src).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    )
    expect(parseEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.original).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    )
    expect(parseEmbedUrl('https://vimeo.com/76979871')?.src).toBe('https://player.vimeo.com/video/76979871')
    expect(parseEmbedUrl('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseEmbedUrl('https://example.com/v')).toBeNull()
    expect(embedOriginal('https://player.vimeo.com/video/76979871')).toBe('https://vimeo.com/76979871')
    expect(embedOriginal('https://evil.test/x')).toBe('')
  })

  it('links are http(s) or mailto only', () => {
    expect(isSafeLink('https://x.test')).toBe(true)
    expect(isSafeLink('mailto:a@b.c')).toBe(true)
    expect(isSafeLink('javascript:alert(1)')).toBe(false)
    expect(isSafeLink('/relative')).toBe(false)
  })

  it('classifies files and urls', () => {
    expect(kindOfFile({ type: 'audio/mpeg' })).toBe('audio')
    expect(kindOfUrl('https://x.test/a.mp3')).toBe('audio')
    expect(kindOfAny({ type: 'application/pdf', name: 'a.pdf' })).toBe('file')
    expect(kindOfAny({ type: 'text/html', name: 'a.html' })).toBeNull()
    expect(kindOfAny({ type: 'image/svg+xml', name: 'a.svg' })).toBe('image')
    expect(fileBlockMime({ type: '', name: 'report.docx' })).toMatch(/wordprocessingml/)
    expect(fileBlockMime({ type: '', name: 'run.exe' })).toBeNull()
  })
})

describe('schema and operations', () => {
  it('old documents without the new attributes still load with the caption shown', () => {
    const { editor, destroy } = make()
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'media',
          attrs: { kind: 'image', src: 'https://x.test/a.png', width: 300, align: 'left' },
          content: [{ type: 'text', text: 'old' }],
        },
      ],
    })
    const node = mediaNode(editor)
    expect(node.attrs).toMatchObject({
      kind: 'image',
      width: 300,
      align: 'left',
      showCaption: true,
      alt: '',
      full: false,
      shape: 'none',
    })
    expect(node.textContent).toBe('old')
    expect(editor.view.dom.querySelector('figure')?.getAttribute('data-caption')).toBe('on')
    destroy()
  })

  it('renders each kind with the right element, never an arbitrary iframe', () => {
    const { editor, destroy } = make()
    const render = (attrs: Record<string, unknown>) => {
      editor.commands.setContent({ type: 'doc', content: [{ type: 'media', attrs, content: [] }] })
      return editor.view.dom.querySelector('figure')?.outerHTML ?? ''
    }
    expect(render({ kind: 'audio', src: 'https://x.test/a.mp3' })).toContain('<audio')
    expect(render({ kind: 'video', src: 'https://x.test/a.mp4' })).toContain('<video')
    const embed = render({ kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' })
    expect(embed).toContain('<iframe')
    expect(embed).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"')
    expect(render({ kind: 'embed', src: 'https://evil.test/embed/dQw4w9WgXcQ' })).not.toContain('src="https://evil')
    expect(render({ kind: 'image', src: 'https://x.test/a.png', link: 'javascript:alert(1)' })).not.toContain(
      'javascript',
    )
    const file = render({ kind: 'file', src: 'data:application/pdf;base64,AAAA', name: 'Plan.pdf', size: 1536 })
    expect(file).toContain('Plan.pdf')
    expect(file).toContain('1.5 KB')
    const alt = render({ kind: 'image', src: 'https://x.test/a.png', alt: 'A cat' })
    expect(alt).toContain('alt="A cat"')
    expect(alt).toContain('page-media__alt')
    destroy()
  })

  it('refuses a source of the wrong kind and keeps the caption text when it is hidden', () => {
    const { editor, destroy } = make()
    expect(insertMedia.run(editor, 'audio', 'data:image/png;base64,AAAA')).toBe(false)
    expect(insertMedia.run(editor, 'embed', 'https://evil.test/x')).toBe(false)
    expect(insertMedia.run(editor, 'audio', 'data:audio/mpeg;base64,AAAA', undefined, { showCaption: true })).toBe(true)
    const { pos } = mediaNode(editor)
    editor
      .chain()
      .setTextSelection(pos + 1)
      .insertContent('hello')
      .run()
    expect(setMediaDetails.run(editor, pos, { showCaption: false })).toBe(true)
    const hidden = mediaNode(editor)
    expect(hidden.attrs.showCaption).toBe(false)
    expect(hidden.textContent).toBe('hello')
    expect(editor.view.dom.querySelector('figure')?.getAttribute('data-caption')).toBe('off')
    editor.commands.undo()
    expect(mediaNode(editor).attrs.showCaption).toBe(true)
    destroy()
  })

  it('sets alt, link, crop, size as separate undo steps and refuses unsafe values', () => {
    const { editor, destroy } = make()
    insertMedia.run(editor, 'image', 'https://x.test/a.png')
    const { pos } = mediaNode(editor)
    expect(setMediaDetails.run(editor, pos, { link: 'javascript:alert(1)' })).toBe(false)
    expect(setMediaDetails.run(editor, pos, { alt: 'x', link: 'https://x.test' })).toBe(true)
    expect(setMediaDetails.run(editor, pos, { alt: 'x' })).toBe(false)
    expect(setMediaDetails.run(editor, pos, { shape: 'circle', zoom: 9, focusX: -5, focusY: 500 })).toBe(true)
    expect(mediaNode(editor).attrs).toMatchObject({
      alt: 'x',
      link: 'https://x.test',
      shape: 'circle',
      zoom: 3,
      focusX: 0,
      focusY: 100,
    })
    expect(setMediaLayout.run(editor, pos, { width: null, full: true })).toBe(true)
    expect(mediaNode(editor).attrs.full).toBe(true)
    expect(setMediaLayout.run(editor, pos, { width: 300 })).toBe(true)
    expect(mediaNode(editor).attrs).toMatchObject({ width: 300, full: false })
    editor.commands.undo()
    expect(mediaNode(editor).attrs.full).toBe(true)
    destroy()
  })

  it('replace can change a video into an embed and keeps caption, alt and ids', () => {
    const { editor, destroy } = make()
    insertMedia.run(editor, 'video', 'https://x.test/a.mp4')
    const { pos } = mediaNode(editor)
    const id = mediaNode(editor).attrs.blockId
    expect(setMediaSource.run(editor, pos, 'https://evil.test/x', 'embed')).toBe(false)
    expect(setMediaSource.run(editor, pos, 'https://player.vimeo.com/video/76979871', 'embed')).toBe(true)
    expect(mediaNode(editor).attrs).toMatchObject({ kind: 'embed', blockId: id })
    destroy()
  })

  it('nextWidth clamps to the minimum and snaps to full width', () => {
    expect(nextWidth(200, -500, 600)).toEqual({ width: 80, full: false })
    expect(nextWidth(500, 90, 600)).toEqual({ width: 590, full: true })
    expect(nextWidth(200, 100, 600)).toEqual({ width: 300, full: false })
  })
})

describe('bars per kind', () => {
  const ids = (def: (typeof mediaToolbars)[number]) =>
    def.groups
      .flatMap((g) => (g.kind === 'menus' ? g.menus.flatMap((m) => m.sections.flat()) : [...g.actions]))
      .map((a) => a.id)

  it('shows the bar that matches the selected kind only', () => {
    const { editor, destroy } = make()
    const located = () => mediaToolbars.filter((d) => d.locate(editor) !== null).map((d) => d.id)
    insertMedia.run(editor, 'image', 'https://x.test/a.png')
    expect(located()).toEqual(['media:toolbar'])
    insertMedia.run(editor, 'audio', 'https://x.test/a.mp3')
    expect(located()).toEqual(['media:toolbar-audio'])
    insertMedia.run(editor, 'embed', 'https://player.vimeo.com/video/76979871')
    expect(located()).toEqual(['media:toolbar-video'])
    insertMedia.run(editor, 'file', 'https://x.test/a.pdf')
    expect(located()).toEqual(['media:toolbar-file'])
    expect(findSelectedMedia(editor)?.kind).toBe('file')
    destroy()
  })

  it('offers image-only actions on images and not on video, audio or files', () => {
    const image = ids(mediaToolbars[0])
    expect(image).toEqual(
      expect.arrayContaining(['media:alt', 'media:link', 'media:crop', 'media:fullscreen', 'media:caption']),
    )
    for (const other of mediaToolbars.slice(1)) expect(ids(other)).not.toContain('media:alt')
    expect(ids(mediaToolbars[2])).not.toContain('media:full-width')
  })

  it('hides the align menu at full width and toggles the caption through the bar', () => {
    const { editor, destroy } = make()
    insertMedia.run(editor, 'image', 'https://x.test/a.png', undefined, { showCaption: false })
    const image = mediaToolbars[0]
    const group = image.groups[0]
    if (group.kind !== 'menus') throw new Error('align menu expected')
    const menu = group.menus[0]
    expect(menu.visible?.(editor)).toBe(true)
    const { pos } = mediaNode(editor)
    setMediaLayout.run(editor, pos, { width: null, full: true })
    expect(menu.visible?.(editor)).toBe(false)
    const caption = image.groups[1]
    if (caption.kind !== 'buttons') throw new Error('caption button expected')
    expect(caption.actions[0].isActive?.(editor)).toBe(false)
    caption.actions[0].run(editor)
    expect(mediaNode(editor).attrs.showCaption).toBe(true)
    expect(findSelectedMedia(editor)?.pos).toBe(pos)
    destroy()
  })
})

describe('export and import', () => {
  const doc = (attrs: Record<string, unknown>, text = ''): Doc =>
    ({
      type: 'doc',
      content: [{ type: 'media', attrs, content: text ? [{ type: 'text', text }] : [] }],
    }) as unknown as Doc
  const back = (d: Doc) => fromHtml(toHtml(d)).content?.[0]

  it('round-trips image alt, link, crop, caption flag and full width through HTML', () => {
    const attrs = {
      kind: 'image',
      src: 'https://x.test/a.png',
      width: null,
      align: 'left',
      alt: 'A "cat"',
      link: 'https://x.test',
      shape: 'circle',
      zoom: 1.5,
      focusX: 20,
      focusY: 70,
      full: true,
      showCaption: false,
    }
    const node = back(doc(attrs, 'cap')) as { attrs: Record<string, unknown> }
    expect(node.attrs).toMatchObject({
      kind: 'image',
      alt: 'A "cat"',
      link: 'https://x.test',
      shape: 'circle',
      zoom: 1.5,
      focusX: 20,
      focusY: 70,
      full: true,
      showCaption: false,
      align: 'left',
    })
    expect(toHtml(doc(attrs, 'cap'))).not.toContain('>cap<')
  })

  it('round-trips audio, file and embed through HTML', () => {
    expect(
      (back(doc({ kind: 'audio', src: 'https://x.test/a.mp3' })) as unknown as { attrs: { kind: string } }).attrs.kind,
    ).toBe('audio')
    const file = back(doc({ kind: 'file', src: 'data:application/pdf;base64,AAAA', name: 'Plan.pdf', size: 1536 })) as {
      attrs: Record<string, unknown>
    }
    expect(file.attrs).toMatchObject({ kind: 'file', name: 'Plan.pdf', size: 1536 })
    const embed = back(doc({ kind: 'embed', src: 'https://player.vimeo.com/video/76979871' })) as {
      attrs: Record<string, unknown>
    }
    expect(embed.attrs).toMatchObject({ kind: 'embed', src: 'https://player.vimeo.com/video/76979871' })
    expect(toHtml(doc({ kind: 'embed', src: 'https://evil.test/x' }))).not.toContain('evil.test')
  })

  it('writes Markdown that keeps each kind visible and safe', () => {
    expect(toMarkdown(doc({ kind: 'image', src: 'https://x.test/a.png', alt: 'cat' }))).toContain(
      '![cat](https://x.test/a.png)',
    )
    expect(toMarkdown(doc({ kind: 'audio', src: 'https://x.test/a.mp3' }))).toContain(
      '<audio src="https://x.test/a.mp3">',
    )
    expect(toMarkdown(doc({ kind: 'file', src: 'https://x.test/a.pdf', name: 'Plan.pdf' }))).toContain(
      '[Plan.pdf](https://x.test/a.pdf)',
    )
    expect(toMarkdown(doc({ kind: 'embed', src: 'https://player.vimeo.com/video/76979871' }, 'Demo'))).toContain(
      '(https://vimeo.com/76979871)',
    )
    expect(toMarkdown(doc({ kind: 'image', src: 'https://x.test/a.png' }, 'cap'))).toContain('![cap]')
    expect(fromMarkdown('![cat](https://x.test/a.png)').content?.[0].type).toBe('media')
  })

  it('imported documents lose media with the wrong source for its kind and unsafe links', () => {
    const imported = sanitizeImported({
      type: 'doc',
      content: [
        { type: 'media', attrs: { kind: 'embed', src: 'https://evil.test/x' }, content: [] },
        { type: 'media', attrs: { kind: 'audio', src: 'data:text/html;base64,AAAA' }, content: [] },
        {
          type: 'media',
          attrs: { kind: 'image', src: 'https://x.test/a.png', link: 'javascript:alert(1)' },
          content: [],
        },
      ],
    } as unknown as Doc)
    expect(imported.content).toHaveLength(1)
    expect((imported.content?.[0].attrs as { link: string }).link).toBe('')
  })
})

describe('reading files', () => {
  it('reports progress, refuses oversized files and can be cancelled', async () => {
    const ok = await readAsDataUrl(new File([new Uint8Array(10)], 'a.png', { type: 'image/png' }), {
      onProgress: () => undefined,
    })
    expect(ok).toMatchObject({ ok: true, name: 'a.png', size: 10 })
    const big = { size: 9 * 1024 * 1024, name: 'big.mp4', type: 'video/mp4' } as File
    expect(await readAsDataUrl(big)).toMatchObject({ ok: false })
    const controller = new AbortController()
    controller.abort()
    expect(
      await readAsDataUrl(new File([new Uint8Array(10)], 'a.png', { type: 'image/png' }), {
        signal: controller.signal,
      }),
    ).toMatchObject({ ok: false, cancelled: true })
  })
})

describe('comment thread survives edits', () => {
  it('keeps commentThread across alt, layout and source changes', () => {
    const { editor } = make()
    insertMedia.run(editor, 'image', 'data:image/png;base64,AAAA')
    const pos = mediaNode(editor).pos
    editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'commentThread', 'thread-1'))
    setMediaDetails.run(editor, pos, { alt: 'a cat' } as never)
    setMediaLayout.run(editor, pos, { width: 300 } as never)
    expect(mediaNode(editor).attrs.commentThread).toBe('thread-1')
  })
})

describe('bookmark link card', () => {
  it('accepts only http(s) addresses and round-trips through HTML and Markdown', () => {
    const { editor } = make()
    expect(insertMedia.run(editor, 'bookmark', 'javascript:alert(1)')).toBe(false)
    expect(insertMedia.run(editor, 'bookmark', 'data:text/html;base64,AAAA')).toBe(false)
    expect(insertMedia.run(editor, 'bookmark', '/relative')).toBe(false)
    expect(insertMedia.run(editor, 'bookmark', 'https://example.com/page')).toBe(true)
    expect(mediaNode(editor).attrs.kind).toBe('bookmark')
    const html = toHtml(editor.getJSON() as never)
    expect(html).toContain('href="https://example.com/page"')
    const back = fromHtml(html)
    expect(JSON.stringify(back)).toContain('"kind":"bookmark"')
    expect(toMarkdown(editor.getJSON() as never)).toContain('(https://example.com/page)')
  })
})
