import { describe, expect, it } from 'vitest'
import { toDocx } from './docx'
import { FIXTURE_DOC, PIXEL_PNG } from './fixture'
import { crc32, readZip } from './zip'

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

describe('toDocx', () => {
  const bytes = toDocx(FIXTURE_DOC)
  const entries = readZip(bytes)
  const documentXml = new TextDecoder().decode(entries.get('word/document.xml'))
  const rels = new TextDecoder().decode(entries.get('word/_rels/document.xml.rels'))

  it('is a valid ZIP whose entries carry correct CRCs', () => {
    expect(bytes[0]).toBe(0x50) // P
    expect(bytes[1]).toBe(0x4b) // K
    for (const [, data] of entries) {
      expect(crc32(data)).toBeGreaterThanOrEqual(0) // recomputes without error
    }
    expect([...entries.keys()]).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        '_rels/.rels',
        'word/document.xml',
        'word/styles.xml',
        'word/_rels/document.xml.rels',
      ]),
    )
  })

  it('keeps text content across nodes', () => {
    for (const text of [
      'Spec &amp; &quot;Plan&quot;',
      'bold',
      'first',
      'nested',
      '\u2611 ',
      '\u2610 ',
      'quoted &lt;text&gt;',
      'const x = 1',
      'Name',
      'spans both',
      'left tile',
      'right tile',
      'Watch out',
      'Careful with this step.',
      'A pixel',
      '\u25B8 More',
      'hidden body',
    ]) {
      expect(documentXml).toContain(text)
    }
    expect(documentXml).toContain('<w:tbl>')
    expect(documentXml).toContain('<w:gridSpan w:val="2"/>')
    expect(documentXml).toContain('<w:pStyle w:val="Heading1"/>')
  })

  it('embeds data-URL images and links remote media', () => {
    expect(entries.has('word/media/image1.png')).toBe(true)
    expect(entries.get('word/media/image1.png')).toEqual(base64ToBytes(PIXEL_PNG))
    expect(rels).toContain('relationships/image')
    expect(documentXml).toContain('[Video: https://example.com/clip.mp4]')
  })

  it('exports hyperlinks as external relationships', () => {
    expect(rels).toContain('Target="https://example.com/spec" TargetMode="External"')
    expect(documentXml).toContain('<w:hyperlink r:id="')
  })
})
