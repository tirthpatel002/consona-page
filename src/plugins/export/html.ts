import { isBlobRef } from '../media/host'
import { asFocus, asKind, asShape, asZoom, formatBytes, isSafeLink, isSafeMediaSrc } from '../media/sources'
import { printStyles } from './printStyles'
import { numberAttr, stringAttr, textOf, type Doc, type DocMark, type DocNode } from './types'

/**
 * HTML <-> TipTap JSON. The emitted HTML uses the same data attributes as the editor schema,
 * so it round-trips through fromHtml and through the editor's own paste parsing.
 */

export /** Cells per row from `data-tracks`, or null when absent or out of range. */
function tracksOf(element: Element): number | null {
  const value = Number(element.getAttribute('data-tracks'))
  return Number.isInteger(value) && value >= 2 && value <= 6 ? value : null
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** A plain CSS color: hex, named, or a rgb/hsl function. Anything else is dropped from the export. */
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,30}|(?:rgb|hsl)a?\([0-9.,%\s/-]{1,60}\))$/i

function styleOf(marks: readonly DocMark[]): string {
  const parts: string[] = []
  for (const mark of marks) {
    if (mark.type !== 'textStyle') continue
    const color = mark.attrs?.color
    const background = mark.attrs?.backgroundColor
    if (typeof color === 'string' && SAFE_COLOR.test(color.trim())) parts.push(`color: ${color.trim()}`)
    if (typeof background === 'string' && SAFE_COLOR.test(background.trim()))
      parts.push(`background-color: ${background.trim()}`)
  }
  return parts.join('; ')
}

/** Serializes inline content to HTML. */
export function inlineToHtml(content: readonly DocNode[] | undefined): string {
  return (content ?? [])
    .map((node) => {
      if (node.type === 'hardBreak') return '<br>'
      if (node.type !== 'text') return escapeHtml(textOf(node))
      const marks = node.marks ?? []
      let out = escapeHtml(node.text ?? '')
      const style = styleOf(marks)
      if (style) out = `<span style="${style}">${out}</span>`
      if (marks.some((mark) => mark.type === 'code')) out = `<code>${out}</code>`
      if (marks.some((mark) => mark.type === 'bold')) out = `<strong>${out}</strong>`
      if (marks.some((mark) => mark.type === 'italic')) out = `<em>${out}</em>`
      if (marks.some((mark) => mark.type === 'underline')) out = `<u>${out}</u>`
      if (marks.some((mark) => mark.type === 'strike')) out = `<s>${out}</s>`
      const link = marks.find((mark) => mark.type === 'link')
      const href = link && typeof link.attrs?.href === 'string' ? link.attrs.href : null
      if (href) out = `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${out}</a>`
      return out
    })
    .join('')
}

function embedToHtml(node: DocNode): string {
  const blockType = stringAttr(node, 'blockType') ?? 'embed'
  const props = node.attrs?.props ?? {}
  const dataProps = escapeHtml(JSON.stringify(props))
  const record = typeof props === 'object' && props !== null ? (props as Record<string, unknown>) : {}
  if (blockType === 'callout') {
    const variant = typeof record.variant === 'string' ? record.variant : 'info'
    const title = typeof record.title === 'string' ? record.title : ''
    const body = typeof record.body === 'string' ? record.body : ''
    return (
      `<div data-block-type="callout" data-props="${dataProps}">` +
      `<div class="page-callout page-callout--${escapeHtml(variant)}">` +
      (title ? `<strong>${escapeHtml(title)}</strong>` : '') +
      `<p>${escapeHtml(body)}</p></div></div>`
    )
  }
  return (
    `<div data-block-type="${escapeHtml(blockType)}" data-props="${dataProps}">` +
    `<div class="page-embed-fallback">${escapeHtml(`${blockType} block`)}</div></div>`
  )
}

function mediaToHtml(node: DocNode): string {
  const kind = asKind(stringAttr(node, 'kind'))
  const rawSrc = stringAttr(node, 'src') ?? ''
  const src = isSafeMediaSrc(kind, rawSrc) ? rawSrc : ''
  if (!src && isBlobRef(stringAttr(node, 'blob'))) {
    return `<p>[${escapeHtml(stringAttr(node, 'name') || 'File')}: stored in the page's file store, not included in this export]</p>`
  }
  const width = numberAttr(node, 'width')
  const full = (node.attrs as { full?: unknown } | undefined)?.full === true
  const align = stringAttr(node, 'align') ?? 'center'
  const altAttr = stringAttr(node, 'alt') ?? ''
  const name = stringAttr(node, 'name') ?? ''
  const size = numberAttr(node, 'size')
  const linkRaw = stringAttr(node, 'link') ?? ''
  const link = isSafeLink(linkRaw) ? linkRaw : ''
  const shape = asShape(stringAttr(node, 'shape'))
  const zoom = asZoom(numberAttr(node, 'zoom') ?? 1)
  const fx = asFocus(numberAttr(node, 'focusX') ?? 50)
  const fy = asFocus(numberAttr(node, 'focusY') ?? 50)
  const captionOn = (node.attrs as { showCaption?: unknown } | undefined)?.showCaption !== false
  const captionText = textOf({ type: 'media', content: node.content })
  const caption = captionOn ? inlineToHtml(node.content) : ''
  let frame: string
  if (kind === 'video') frame = `<video src="${escapeHtml(src)}" controls></video>`
  else if (kind === 'audio') frame = `<audio src="${escapeHtml(src)}" controls></audio>`
  else if (kind === 'embed') {
    frame = `<iframe src="${escapeHtml(src)}" title="${escapeHtml(altAttr || 'Embedded video')}" sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`
  } else if (kind === 'bookmark') {
    const label = name || src.replace(/^https?:\/\//i, '')
    frame = `<a class="page-media__bookmark" href="${escapeHtml(src)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  } else if (kind === 'file') {
    const label = name || 'File'
    frame = `<a href="${escapeHtml(src)}" download="${escapeHtml(label)}">${escapeHtml(label)}${size !== null ? ` (${escapeHtml(formatBytes(size))})` : ''}</a>`
  } else {
    const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(altAttr || captionText)}"${
      zoom !== 1 || fx !== 50 || fy !== 50 ? ` style="--media-zoom: ${zoom}; --media-x: ${fx}%; --media-y: ${fy}%"` : ''
    }>`
    frame = link ? `<a href="${escapeHtml(link)}" rel="noopener noreferrer">${img}</a>` : img
  }
  const data =
    (width !== null && !full ? ` data-width="${width}"` : '') +
    (full ? ' data-full="true"' : '') +
    (altAttr ? ` data-alt="${escapeHtml(altAttr)}"` : '') +
    (link ? ` data-link="${escapeHtml(link)}"` : '') +
    (kind === 'image' && shape !== 'none' ? ` data-shape="${shape}"` : '') +
    (kind === 'image' && zoom !== 1 ? ` data-zoom="${zoom}"` : '') +
    (kind === 'image' && fx !== 50 ? ` data-focus-x="${fx}"` : '') +
    (kind === 'image' && fy !== 50 ? ` data-focus-y="${fy}"` : '') +
    (kind === 'embed' ? ` data-src="${escapeHtml(src)}"` : '') +
    (name ? ` data-name="${escapeHtml(name)}"` : '') +
    (size !== null ? ` data-size="${size}"` : '') +
    (captionOn ? '' : ' data-caption="off"')
  return (
    `<figure data-type="media" data-kind="${kind}" data-align="${escapeHtml(align)}"${data}` +
    ` class="page-media"><div class="page-media__frame"${width !== null && !full ? ` style="width: ${width}px"` : ''}>` +
    `${frame}</div><figcaption>${caption}</figcaption></figure>`
  )
}

/** Serializes one block node to HTML. Unknown nodes keep at least their text. */
export function blockToHtml(node: DocNode): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${inlineToHtml(node.content)}</p>`
    case 'heading': {
      const level = Math.min(Math.max(numberAttr(node, 'level') ?? 1, 1), 6)
      return `<h${level}>${inlineToHtml(node.content)}</h${level}>`
    }
    case 'bulletList': {
      const marker = stringAttr(node, 'marker')
      return `<ul${marker ? ` data-marker="${escapeHtml(marker)}"` : ''}>${childrenHtml(node)}</ul>`
    }
    case 'orderedList': {
      const marker = stringAttr(node, 'marker')
      return `<ol${marker ? ` data-marker="${escapeHtml(marker)}"` : ''}>${childrenHtml(node)}</ol>`
    }
    case 'taskList':
      return `<ul data-type="taskList">${childrenHtml(node)}</ul>`
    case 'taskItem':
      return `<li data-type="taskItem" data-checked="${node.attrs?.checked === true ? 'true' : 'false'}">${childrenHtml(node)}</li>`
    case 'listItem':
      return `<li>${childrenHtml(node)}</li>`
    case 'blockquote':
      return `<blockquote>${childrenHtml(node)}</blockquote>`
    case 'codeBlock': {
      const language = stringAttr(node, 'language')
      const code = (node.content ?? []).map((child) => child.text ?? '').join('')
      return `<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${escapeHtml(code)}</code></pre>`
    }
    case 'horizontalRule':
      return '<hr>'
    case 'details': {
      const summary = node.content?.find((child) => child.type === 'detailsSummary')
      const content = node.content?.find((child) => child.type === 'detailsContent')
      return (
        `<details data-persist="true"${node.attrs?.open === true ? ' open' : ''}><summary>${inlineToHtml(summary?.content)}</summary>` +
        `<div data-type="detailsContent">${(content?.content ?? []).map(blockToHtml).join('')}</div></details>`
      )
    }
    case 'table':
      return `<table><tbody>${childrenHtml(node)}</tbody></table>`
    case 'tableRow':
      return `<tr>${childrenHtml(node)}</tr>`
    case 'tableHeader':
    case 'tableCell': {
      const tag = node.type === 'tableHeader' ? 'th' : 'td'
      const colspan = numberAttr(node, 'colspan')
      const rowspan = numberAttr(node, 'rowspan')
      return (
        `<${tag}${colspan && colspan > 1 ? ` colspan="${colspan}"` : ''}${rowspan && rowspan > 1 ? ` rowspan="${rowspan}"` : ''}>` +
        `${childrenHtml(node)}</${tag}>`
      )
    }
    case 'card': {
      const tone = stringAttr(node, 'tone') ?? 'plain'
      return `<div data-type="card" data-tone="${escapeHtml(tone)}" class="page-card">${childrenHtml(node)}</div>`
    }
    case 'columnList': {
      const layout = stringAttr(node, 'layout') === 'grid' ? 'grid' : 'columns'
      const tracks = Number(node.attrs?.tracks)
      const tracksAttr =
        layout === 'grid' && Number.isInteger(tracks) && tracks >= 2 && tracks <= 6 ? ` data-tracks="${tracks}"` : ''
      return `<div data-type="column-list" data-layout="${layout}"${tracksAttr} class="page-columns">${childrenHtml(node)}</div>`
    }
    case 'column': {
      const width = numberAttr(node, 'width') ?? 1
      return `<div data-type="column" data-width="${width}" style="flex-grow: ${width}" class="page-column">${childrenHtml(node)}</div>`
    }
    case 'embedBlock':
      return embedToHtml(node)
    case 'media':
      return mediaToHtml(node)
    case 'hardBreak':
      return '<br>'
    default:
      return `<div data-unknown-type="${escapeHtml(node.type)}"><p>${escapeHtml(textOf(node))}</p></div>`
  }
}

function childrenHtml(node: DocNode): string {
  return (node.content ?? []).map(blockToHtml).join('')
}

export interface HtmlOptions {
  /** Wraps the body in a full document with the export stylesheet (default: true). */
  readonly standalone?: boolean
  readonly title?: string
}

/** Serializes the document to HTML (a complete styled document by default). */
export function toHtml(doc: Doc, options: HtmlOptions = {}): string {
  const body = (doc.content ?? []).map(blockToHtml).join('\n')
  if (options.standalone === false) return body
  const title = escapeHtml(options.title ?? 'Page')
  return (
    `<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${title}</title><style>${printStyles}</style></head><body class="page-export">\n${body}\n</body></html>\n`
  )
}

// ---------------------------------------------------------------------------
// HTML -> TipTap JSON (DOMParser based; runs in the browser and jsdom)
// ---------------------------------------------------------------------------

function markOf(type: string, marks: readonly DocMark[]): NonNullable<DocNode['marks']> {
  return marks.some((mark) => mark.type === type) ? [...marks] : [...marks, { type }]
}

function inlineFromChildren(element: Element | Node, marks: readonly DocMark[]): DocNode[] {
  const nodes: DocNode[] = []
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 3) {
      const text = child.textContent ?? ''
      if (text.length > 0 && (text.trim().length > 0 || nodes.length > 0)) {
        nodes.push({ type: 'text', text, ...(marks.length > 0 ? { marks: [...marks] } : {}) })
      }
      continue
    }
    if (child.nodeType !== 1) continue
    const el = child as Element
    switch (el.tagName.toLowerCase()) {
      case 'strong':
      case 'b':
        nodes.push(...inlineFromChildren(el, markOf('bold', marks)))
        break
      case 'em':
      case 'i':
        nodes.push(...inlineFromChildren(el, markOf('italic', marks)))
        break
      case 'u':
      case 'ins':
        nodes.push(...inlineFromChildren(el, markOf('underline', marks)))
        break
      case 's':
      case 'del':
      case 'strike':
        nodes.push(...inlineFromChildren(el, markOf('strike', marks)))
        break
      case 'code':
        nodes.push(...inlineFromChildren(el, markOf('code', marks)))
        break
      case 'a': {
        const href = el.getAttribute('href')
        nodes.push(...inlineFromChildren(el, href ? [...marks, { type: 'link', attrs: { href } }] : marks))
        break
      }
      case 'span': {
        const style = (el as HTMLElement).style
        const color = style.color || null
        const background = style.backgroundColor || null
        if (color || background) {
          nodes.push(
            ...inlineFromChildren(el, [
              ...marks,
              {
                type: 'textStyle',
                attrs: { ...(color ? { color } : {}), ...(background ? { backgroundColor: background } : {}) },
              },
            ]),
          )
        } else {
          nodes.push(...inlineFromChildren(el, marks))
        }
        break
      }
      case 'br':
        nodes.push({ type: 'hardBreak' })
        break
      default:
        nodes.push(...inlineFromChildren(el, marks))
    }
  }
  return nodes
}

function paragraphFrom(element: Element): DocNode {
  return { type: 'paragraph', content: inlineFromChildren(element, []) }
}

function listFrom(element: Element): DocNode {
  const isTask =
    element.getAttribute('data-type') === 'taskList' ||
    element.querySelector(':scope > li input[type="checkbox"]') !== null ||
    element.querySelector(':scope > li[data-type="taskItem"]') !== null
  const marker = element.getAttribute('data-marker')
  const items: DocNode[] = []
  for (const li of Array.from(element.children)) {
    if (li.tagName.toLowerCase() !== 'li') continue
    const content: DocNode[] = []
    const inlineHost = li.ownerDocument.createElement('span')
    for (const child of Array.from(li.childNodes)) {
      if (child.nodeType === 1 && ['ul', 'ol'].includes((child as Element).tagName.toLowerCase())) {
        content.push(listFrom(child as Element))
      } else if (child.nodeType === 1 && (child as Element).tagName.toLowerCase() === 'input') {
        continue // checkbox marker
      } else if (
        child.nodeType === 1 &&
        ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'table'].includes(
          (child as Element).tagName.toLowerCase(),
        )
      ) {
        const block = blockFromElement(child as Element)
        if (block) content.push(block)
      } else {
        inlineHost.append(child.cloneNode(true))
      }
    }
    const inline = inlineFromChildren(inlineHost, [])
    if (inline.length > 0 || content.length === 0) content.unshift({ type: 'paragraph', content: inline })
    if (isTask) {
      const checkedAttr = li.getAttribute('data-checked')
      const checkbox = li.querySelector('input[type="checkbox"]')
      items.push({
        type: 'taskItem',
        attrs: {
          checked: checkedAttr === 'true' || (checkedAttr === null && checkbox?.hasAttribute('checked') === true),
        },
        content,
      })
    } else {
      items.push({ type: 'listItem', content })
    }
  }
  const type = isTask ? 'taskList' : element.tagName.toLowerCase() === 'ol' ? 'orderedList' : 'bulletList'
  return { type, ...(marker && !isTask ? { attrs: { marker } } : {}), content: items }
}

function tableFrom(element: Element): DocNode {
  const rows: DocNode[] = []
  for (const tr of Array.from(element.querySelectorAll('tr'))) {
    const cells: DocNode[] = []
    for (const cell of Array.from(tr.children)) {
      const tag = cell.tagName.toLowerCase()
      if (tag !== 'th' && tag !== 'td') continue
      const colspan = Number(cell.getAttribute('colspan') ?? '1')
      const rowspan = Number(cell.getAttribute('rowspan') ?? '1')
      const content = blocksFromChildren(cell)
      cells.push({
        type: tag === 'th' ? 'tableHeader' : 'tableCell',
        attrs: {
          colspan: colspan > 1 ? colspan : 1,
          rowspan: rowspan > 1 ? rowspan : 1,
          colwidth: null,
        },
        content: content.length > 0 ? content : [{ type: 'paragraph' }],
      })
    }
    if (cells.length > 0) rows.push({ type: 'tableRow', content: cells })
  }
  return { type: 'table', content: rows }
}

function mediaFromFigure(figure: Element): DocNode | null {
  const kind = asKind(figure.getAttribute('data-kind'))
  const raw =
    kind === 'embed'
      ? (figure.getAttribute('data-src') ?? '')
      : kind === 'bookmark'
        ? (figure.querySelector('a.page-media__bookmark')?.getAttribute('href') ?? '')
        : kind === 'file'
          ? (figure.querySelector('a[href]')?.getAttribute('href') ?? '')
          : (figure.querySelector(kind === 'image' ? 'img' : kind)?.getAttribute('src') ?? '')
  if (!raw) return null
  const widthAttr = figure.getAttribute('data-width')
  const caption = figure.querySelector('figcaption')
  const alignAttr = figure.getAttribute('data-align')
  const number = (name: string) => {
    const value = Number(figure.getAttribute(name))
    return figure.hasAttribute(name) && Number.isFinite(value) ? value : null
  }
  const link = figure.getAttribute('data-link') ?? ''
  const attrs: Record<string, unknown> = {
    kind,
    src: raw,
    width: widthAttr ? Number(widthAttr) || null : null,
    align: alignAttr === 'left' || alignAttr === 'right' ? alignAttr : 'center',
  }
  if (figure.hasAttribute('data-alt')) attrs.alt = figure.getAttribute('data-alt')
  if (isSafeLink(link)) attrs.link = link
  if (figure.getAttribute('data-caption') === 'off') attrs.showCaption = false
  if (figure.getAttribute('data-full') === 'true') attrs.full = true
  if (figure.hasAttribute('data-shape')) attrs.shape = asShape(figure.getAttribute('data-shape'))
  if (number('data-zoom') !== null) attrs.zoom = asZoom(number('data-zoom'))
  if (number('data-focus-x') !== null) attrs.focusX = asFocus(number('data-focus-x'))
  if (number('data-focus-y') !== null) attrs.focusY = asFocus(number('data-focus-y'))
  if (figure.hasAttribute('data-name')) attrs.name = figure.getAttribute('data-name')
  if (number('data-size') !== null) attrs.size = number('data-size')
  return { type: 'media', attrs, content: caption ? inlineFromChildren(caption, []) : [] }
}

/** Converts one HTML element to a block node; null means "flatten my children". */
export function blockFromElement(element: Element): DocNode | null {
  const tag = element.tagName.toLowerCase()
  if (/^h[1-6]$/.test(tag)) {
    return { type: 'heading', attrs: { level: Number(tag[1]) }, content: inlineFromChildren(element, []) }
  }
  switch (tag) {
    case 'p': {
      const paragraph = paragraphFrom(element)
      const hasText = (paragraph.content ?? []).some((node) => node.type !== 'text' || (node.text ?? '').trim() !== '')
      if (!hasText) {
        const image = element.querySelector('img')
        if (image?.getAttribute('src')) {
          return {
            type: 'media',
            attrs: { kind: 'image', src: image.getAttribute('src'), width: null, align: 'center' },
            content: [],
          }
        }
        const video = element.querySelector('video')
        const videoSrc = video?.getAttribute('src') ?? video?.querySelector('source')?.getAttribute('src')
        if (videoSrc) {
          return {
            type: 'media',
            attrs: { kind: 'video', src: videoSrc, width: null, align: 'center' },
            content: [],
          }
        }
      }
      return paragraph
    }
    case 'ul':
    case 'ol':
      return listFrom(element)
    case 'blockquote':
      return { type: 'blockquote', content: blocksFromChildren(element) }
    case 'pre': {
      const code = element.querySelector('code')
      const language = code?.getAttribute('class')?.match(/language-(\S+)/)?.[1]
      return {
        type: 'codeBlock',
        ...(language ? { attrs: { language } } : {}),
        content: [{ type: 'text', text: (code ?? element).textContent ?? '' }],
      }
    }
    case 'hr':
      return { type: 'horizontalRule' }
    case 'details': {
      const summary = element.querySelector(':scope > summary')
      const contentHost =
        element.querySelector(':scope > [data-type="detailsContent"]') ?? element.querySelector(':scope > div')
      const summaryContent = summary ? inlineFromChildren(summary, []) : []
      const content = contentHost ? blocksFromChildren(contentHost) : []
      return {
        type: 'details',
        attrs: { open: element.hasAttribute('open') },
        content: [
          { type: 'detailsSummary', content: summaryContent },
          { type: 'detailsContent', content: content.length > 0 ? content : [{ type: 'paragraph' }] },
        ],
      }
    }
    case 'table':
      return tableFrom(element)
    case 'figure': {
      if (element.getAttribute('data-type') === 'media') return mediaFromFigure(element)
      const image = element.querySelector('img')
      if (image?.getAttribute('src')) {
        return {
          type: 'media',
          attrs: { kind: 'image', src: image.getAttribute('src'), width: null, align: 'center' },
          content: [],
        }
      }
      return null
    }
    case 'img': {
      const src = element.getAttribute('src')
      return src ? { type: 'media', attrs: { kind: 'image', src, width: null, align: 'center' }, content: [] } : null
    }
    case 'audio': {
      const src = element.getAttribute('src') ?? element.querySelector('source')?.getAttribute('src')
      return src ? { type: 'media', attrs: { kind: 'audio', src, width: null, align: 'center' }, content: [] } : null
    }
    case 'video': {
      const src = element.getAttribute('src') ?? element.querySelector('source')?.getAttribute('src')
      return src ? { type: 'media', attrs: { kind: 'video', src, width: null, align: 'center' }, content: [] } : null
    }
    case 'div': {
      if (element.getAttribute('data-type') === 'column-list') {
        const columns = Array.from(element.children)
          .filter((child) => child.getAttribute('data-type') === 'column')
          .map((child) => ({
            type: 'column',
            attrs: { width: Number(child.getAttribute('data-width')) || 1 },
            content: blocksFromChildren(child),
          }))
        return columns.length > 0
          ? {
              type: 'columnList',
              attrs: {
                layout: element.getAttribute('data-layout') === 'grid' ? 'grid' : 'columns',
                ...(element.getAttribute('data-layout') === 'grid' && tracksOf(element) !== null
                  ? { tracks: tracksOf(element) }
                  : {}),
              },
              content: columns,
            }
          : null
      }
      if (element.getAttribute('data-type') === 'card') {
        const toneAttr = element.getAttribute('data-tone')
        return {
          type: 'card',
          attrs: { tone: toneAttr === 'muted' || toneAttr === 'accent' ? toneAttr : 'plain' },
          content: blocksFromChildren(element),
        }
      }
      const blockType = element.getAttribute('data-block-type')
      if (blockType !== null) {
        let props: Record<string, unknown> = {}
        try {
          const parsed: unknown = JSON.parse(element.getAttribute('data-props') ?? '{}')
          if (typeof parsed === 'object' && parsed !== null) props = parsed as Record<string, unknown>
        } catch {
          props = {}
        }
        return { type: 'embedBlock', attrs: { blockType, props } }
      }
      return null // generic container: flatten
    }
    default:
      return null
  }
}

function blocksFromChildren(element: Element): DocNode[] {
  const blocks: DocNode[] = []
  const flushInline = (host: Element): void => {
    const inline = inlineFromChildren(host, [])
    if (inline.some((node) => node.type !== 'text' || (node.text ?? '').trim() !== '')) {
      blocks.push({ type: 'paragraph', content: inline })
    }
    host.replaceChildren()
  }
  const inlineHost = element.ownerDocument.createElement('span')
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 3) {
      inlineHost.append(child.cloneNode(true))
      continue
    }
    if (child.nodeType !== 1) continue
    const el = child as Element
    const block = blockFromElement(el)
    if (block === null) {
      if (
        ['div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'nav', 'tbody', 'thead', 'body'].includes(
          el.tagName.toLowerCase(),
        )
      ) {
        flushInline(inlineHost)
        blocks.push(...blocksFromChildren(el))
      } else {
        inlineHost.append(el.cloneNode(true))
      }
      continue
    }
    flushInline(inlineHost)
    blocks.push(block)
  }
  flushInline(inlineHost)
  return blocks
}

/** Parses an HTML string into TipTap document JSON (content-preserving subset; see README). */
export function fromHtml(html: string): Doc {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  // Non-content elements: drop them with their text so script/style source never becomes page text.
  parsed.body
    .querySelectorAll('script, style, noscript, template, iframe, object, embed, svg, form, link, meta')
    .forEach((el) => el.remove())
  const content = blocksFromChildren(parsed.body)
  return { type: 'doc', content }
}
