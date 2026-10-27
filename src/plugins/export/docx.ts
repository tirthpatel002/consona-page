import { isBlobRef } from '../media/host'
import { embedOriginal } from '../media/sources'
import { imageSize } from './imageSize'
import { numberAttr, stringAttr, textOf, type Doc, type DocMark, type DocNode } from './types'
import { createZip, type ZipEntry } from './zip'

/**
 * TipTap JSON -> .docx (Office Open XML package) with no runtime dependencies:
 * a small WordprocessingML document plus embedded data-URL images, packaged as a stored ZIP.
 * Deliberate simplifications (see README): lists use literal bullet/number characters,
 * remote images and videos export as links, column layouts flatten to a sequence.
 */

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function base64ToBytes(base64: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup = new Map<string, number>([...alphabet].map((char, index) => [char, index]))
  const clean = base64.replace(/=+$/, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let cursor = 0
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = [0, 1, 2, 3].map((k) => lookup.get(clean[i + k]) ?? 0)
    const value = (chunk[0] << 18) | (chunk[1] << 12) | (chunk[2] << 6) | chunk[3]
    if (cursor < out.length) out[cursor++] = (value >>> 16) & 0xff
    if (cursor < out.length) out[cursor++] = (value >>> 8) & 0xff
    if (cursor < out.length) out[cursor++] = value & 0xff
  }
  return out
}

interface Relationship {
  readonly id: string
  readonly type: 'hyperlink' | 'image'
  readonly target: string
  readonly external: boolean
}

interface Context {
  readonly rels: Relationship[]
  readonly media: ZipEntry[]
  nextId: number
}

function runProperties(marks: readonly DocMark[], inLink: boolean): string {
  const parts: string[] = []
  const has = (type: string) => marks.some((mark) => mark.type === type)
  if (has('bold')) parts.push('<w:b/>')
  if (has('italic')) parts.push('<w:i/>')
  if (has('underline') || inLink) parts.push('<w:u w:val="single"/>')
  if (has('strike')) parts.push('<w:strike/>')
  if (has('code')) parts.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:val="clear" w:fill="F3F4F6"/>')
  const style = marks.find((mark) => mark.type === 'textStyle')
  const color = style?.attrs?.color
  const background = style?.attrs?.backgroundColor
  if (typeof color === 'string' && color) parts.push(`<w:color w:val="${escapeXml(color.replace('#', ''))}"/>`)
  else if (inLink) parts.push('<w:color w:val="0563C1"/>')
  if (typeof background === 'string' && background) {
    parts.push(`<w:shd w:val="clear" w:fill="${escapeXml(background.replace('#', ''))}"/>`)
  }
  return parts.length > 0 ? `<w:rPr>${parts.join('')}</w:rPr>` : ''
}

function textRun(text: string, marks: readonly DocMark[], inLink: boolean): string {
  return `<w:r>${runProperties(marks, inLink)}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

/** Serializes inline content to WordprocessingML runs; hyperlinks register external relationships. */
export function inlineToDocx(content: readonly DocNode[] | undefined, ctx: Context): string {
  return (content ?? [])
    .map((node) => {
      if (node.type === 'hardBreak') return '<w:r><w:br/></w:r>'
      if (node.type !== 'text') return textRun(textOf(node), [], false)
      const marks = node.marks ?? []
      const link = marks.find((mark) => mark.type === 'link')
      const href = link && typeof link.attrs?.href === 'string' ? link.attrs.href : null
      if (href) {
        const id = `rId${ctx.nextId++}`
        ctx.rels.push({ id, type: 'hyperlink', target: href, external: true })
        const inner = textRun(
          node.text ?? '',
          marks.filter((mark) => mark.type !== 'link'),
          true,
        )
        return `<w:hyperlink r:id="${id}" w:history="1">${inner}</w:hyperlink>`
      }
      return textRun(node.text ?? '', marks, false)
    })
    .join('')
}

function para(runs: string, props = ''): string {
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}${runs}</w:p>`
}

const HEADING_STYLES = ['Heading1', 'Heading2', 'Heading3', 'Heading4'] as const

function listToDocx(list: DocNode, ctx: Context, level: number, out: string[], start = 1): void {
  ;(list.content ?? []).forEach((item, index) => {
    const marker =
      list.type === 'taskList'
        ? item.attrs?.checked === true
          ? '\u2611 '
          : '\u2610 '
        : list.type === 'orderedList'
          ? `${start + index}. `
          : '\u2022 '
    const indent = `<w:ind w:left="${(level + 1) * 360}" w:hanging="360"/>`
    let first = true
    for (const child of item.content ?? []) {
      if (child.type === 'paragraph' || child.type === 'heading') {
        out.push(para(textRun(first ? marker : '', [], false) + inlineToDocx(child.content, ctx), indent))
      } else if (child.type.endsWith('List')) {
        listToDocx(child, ctx, level + 1, out)
      } else {
        blocksToDocx([child], ctx, out)
      }
      first = false
    }
  })
}

function tableToDocx(table: DocNode, ctx: Context, out: string[]): void {
  const borders =
    '<w:tblPr><w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((edge) => `<w:${edge} w:val="single" w:sz="4" w:color="D1D5DB"/>`)
      .join('') +
    '</w:tblBorders></w:tblPr>'
  const active: number[] = [] // remaining rowspan rows per column
  const rows: string[] = []
  for (const row of table.content ?? []) {
    const cells: string[] = []
    let column = 0
    const fillMerged = () => {
      while (active[column] > 0) {
        cells.push('<w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p/></w:tc>')
        active[column] -= 1
        column += 1
      }
    }
    for (const cell of row.content ?? []) {
      fillMerged()
      const colspan = numberAttr(cell, 'colspan') ?? 1
      const rowspan = numberAttr(cell, 'rowspan') ?? 1
      const props: string[] = []
      if (colspan > 1) props.push(`<w:gridSpan w:val="${colspan}"/>`)
      if (rowspan > 1) props.push('<w:vMerge w:val="restart"/>')
      if (cell.type === 'tableHeader') props.push('<w:shd w:val="clear" w:fill="F3F4F6"/>')
      const inner: string[] = []
      blocksToDocx(cell.content ?? [], ctx, inner)
      cells.push(`<w:tc><w:tcPr>${props.join('')}</w:tcPr>${inner.join('') || '<w:p/>'}</w:tc>`)
      for (let c = column; c < column + colspan; c += 1) active[c] = rowspan - 1
      column += colspan
    }
    fillMerged()
    rows.push(`<w:tr>${cells.join('')}</w:tr>`)
  }
  out.push(`<w:tbl>${borders}${rows.join('')}</w:tbl>`)
}

const EMU_PER_PX = 9525
/** Widest picture placed in the page (about the printable width of A4/Letter). */
const MAX_IMAGE_PX = 600

function mediaToDocx(node: DocNode, ctx: Context, out: string[]): void {
  const kind = stringAttr(node, 'kind') ?? 'image'
  const src = stringAttr(node, 'src') ?? ''
  if (!src && isBlobRef(stringAttr(node, 'blob'))) {
    out.push(
      para(
        textRun(
          `[${stringAttr(node, 'name') || 'File'}: stored in the page's file store, not included in this export]`,
          [],
          false,
        ),
      ),
    )
    return
  }
  const caption =
    (node.attrs as { showCaption?: unknown } | undefined)?.showCaption === false
      ? ''
      : textOf({ type: 'media', content: node.content }).trim()
  const dataUrl = src.match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/)
  if (kind === 'image' && dataUrl) {
    const ext = dataUrl[1] === 'jpeg' ? 'jpg' : dataUrl[1]
    const name = `image${ctx.media.length + 1}.${ext}`
    ctx.media.push({ name: `word/media/${name}`, data: base64ToBytes(dataUrl[2]) })
    const id = `rId${ctx.nextId++}`
    ctx.rels.push({ id, type: 'image', target: `media/${name}`, external: false })
    const data = base64ToBytes(dataUrl[2])
    const natural = imageSize(data)
    const width = Math.min(numberAttr(node, 'width') ?? natural?.width ?? 400, MAX_IMAGE_PX)
    const ratio = natural && natural.width > 0 ? natural.height / natural.width : 0.75
    const cx = Math.round(width * EMU_PER_PX)
    const cy = Math.round(width * ratio * EMU_PER_PX)
    out.push(
      para(
        '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
          `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${ctx.media.length + 100}" name="${escapeXml(name)}"/>` +
          '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
          `<pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${escapeXml(name)}"/><pic:cNvPicPr/></pic:nvPicPr>` +
          `<pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
          `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
          '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>' +
          '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>',
      ),
    )
  } else if (src) {
    // Word has no player, file or embed; keep the address (or file name) as visible text.
    const label =
      kind === 'video' || kind === 'embed'
        ? 'Video'
        : kind === 'audio'
          ? 'Audio'
          : kind === 'file'
            ? 'File'
            : kind === 'bookmark'
              ? 'Link'
              : 'Image'
    const shown =
      kind === 'embed' ? embedOriginal(src) : kind === 'file' ? (stringAttr(node, 'name') ?? '') || src : src
    out.push(para(textRun(`[${label}: ${shown.startsWith('data:') ? 'embedded data' : shown}]`, [], false)))
  }
  if (caption) {
    out.push(para(textRun(caption, [{ type: 'textStyle', attrs: { color: '#6b7280' } }], false)))
  }
}

function embedToDocx(node: DocNode, ctx: Context, out: string[]): void {
  const blockType = stringAttr(node, 'blockType') ?? 'embed'
  const props = node.attrs?.props
  const record = typeof props === 'object' && props !== null ? (props as Record<string, unknown>) : {}
  if (blockType === 'callout') {
    const title = typeof record.title === 'string' ? record.title : ''
    const body = typeof record.body === 'string' ? record.body : ''
    const shade =
      '<w:pBdr><w:left w:val="single" w:sz="18" w:color="337EA9"/></w:pBdr><w:shd w:val="clear" w:fill="EFF6FF"/><w:ind w:left="240"/>'
    if (title) out.push(para(textRun(title, [{ type: 'bold' }], false), shade))
    if (body) out.push(para(inlineToDocx([{ type: 'text', text: body }], ctx), shade))
    if (!title && !body) out.push(para(textRun('[callout block]', [], false)))
    return
  }
  out.push(para(textRun(`[${blockType} block]`, [], false)))
}

/** Serializes block nodes to WordprocessingML body elements. */
export function blocksToDocx(nodes: readonly DocNode[], ctx: Context, out: string[]): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        out.push(para(inlineToDocx(node.content, ctx)))
        break
      case 'heading': {
        const level = Math.min(Math.max(numberAttr(node, 'level') ?? 1, 1), HEADING_STYLES.length)
        out.push(para(inlineToDocx(node.content, ctx), `<w:pStyle w:val="${HEADING_STYLES[level - 1]}"/>`))
        break
      }
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        listToDocx(node, ctx, 0, out)
        break
      case 'blockquote':
        for (const child of node.content ?? []) {
          const inner: string[] = []
          blocksToDocx([child], ctx, inner)
          out.push(inner.join('').replaceAll('<w:p>', '<w:p><w:pPr><w:ind w:left="360"/></w:pPr>'))
        }
        break
      case 'codeBlock': {
        const code = (node.content ?? []).map((child) => child.text ?? '').join('')
        const lines = code.split('\n')
        for (const line of lines) {
          out.push(para(textRun(line, [{ type: 'code' }], false), '<w:shd w:val="clear" w:fill="F6F8FA"/>'))
        }
        break
      }
      case 'horizontalRule':
        out.push(para('', '<w:pBdr><w:bottom w:val="single" w:sz="6" w:color="D1D5DB"/></w:pBdr>'))
        break
      case 'details': {
        const summary = node.content?.find((child) => child.type === 'detailsSummary')
        const content = node.content?.find((child) => child.type === 'detailsContent')
        out.push(
          para(
            textRun(
              `\u25B8 ${textOf({ type: 'detailsSummary', content: summary?.content })}`,
              [{ type: 'bold' }],
              false,
            ),
          ),
        )
        blocksToDocx(content?.content ?? [], ctx, out)
        break
      }
      case 'table':
        tableToDocx(node, ctx, out)
        break
      case 'columnList':
      case 'column':
      case 'card':
        // Lossy: layout containers flatten to a top-to-bottom sequence.
        blocksToDocx(node.content ?? [], ctx, out)
        break
      case 'embedBlock':
        embedToDocx(node, ctx, out)
        break
      case 'media':
        mediaToDocx(node, ctx, out)
        break
      case 'hardBreak':
        out.push(para('<w:r><w:br/></w:r>'))
        break
      default: {
        const text = textOf(node)
        if (text) out.push(para(textRun(text, [], false)))
      }
    }
  }
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="3"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
</w:styles>`

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="gif" ContentType="image/gif"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

/** Builds the full .docx package for the document. */
export function toDocx(doc: Doc): Uint8Array {
  const ctx: Context = { rels: [], media: [], nextId: 2 } // rId1 is styles.xml
  const body: string[] = []
  blocksToDocx(doc.content ?? [], ctx, body)
  const documentXml =
    XML +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`
  const docRels =
    XML +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    ctx.rels
      .map(
        (rel) =>
          `<Relationship Id="${rel.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${rel.type}" Target="${escapeXml(rel.target)}"${rel.external ? ' TargetMode="External"' : ''}/>`,
      )
      .join('') +
    '</Relationships>'
  const encode = (text: string) => new TextEncoder().encode(text)
  return createZip([
    { name: '[Content_Types].xml', data: encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: encode(ROOT_RELS) },
    { name: 'word/document.xml', data: encode(documentXml) },
    { name: 'word/styles.xml', data: encode(STYLES_XML) },
    { name: 'word/_rels/document.xml.rels', data: encode(docRels) },
    ...ctx.media,
  ])
}
