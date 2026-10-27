import { describe, expect, it } from 'vitest'
import { isSafeMediaSource, isSafeUrl } from './safeUrl'

const b64 = 'AAAA'
describe('isSafeMediaSource', () => {
  it('accepts http(s) and relative paths for every kind, and rejects other schemes and empty values', () => {
    for (const kind of ['image', 'video', 'audio', 'file'] as const) {
      expect(isSafeMediaSource(kind, 'https://x.test/a')).toBe(true)
      expect(isSafeMediaSource(kind, '/files/a')).toBe(true)
      expect(isSafeMediaSource(kind, './a')).toBe(true)
      for (const bad of [
        '',
        '   ',
        'javascript:alert(1)',
        'mailto:a@b.c',
        'tel:1',
        'blob:https://x/1',
        'ftp://x/a',
        'vbscript:x',
        '#frag',
      ]) {
        expect(isSafeMediaSource(kind, bad)).toBe(false)
      }
    }
  })

  it('accepts exact data types per kind and refuses a data URL of another kind', () => {
    expect(isSafeMediaSource('image', `data:image/png;base64,${b64}`)).toBe(true)
    expect(isSafeMediaSource('video', `data:video/webm;base64,${b64}`)).toBe(true)
    expect(isSafeMediaSource('audio', `data:audio/mpeg;base64,${b64}`)).toBe(true)
    expect(isSafeMediaSource('file', `data:application/pdf;base64,${b64}`)).toBe(true)
    // a file or audio data URL can not be an image source or a link target through this check
    expect(isSafeMediaSource('image', `data:audio/mpeg;base64,${b64}`)).toBe(false)
    expect(isSafeMediaSource('image', `data:application/pdf;base64,${b64}`)).toBe(false)
    expect(isSafeMediaSource('audio', `data:image/png;base64,${b64}`)).toBe(false)
    expect(isSafeMediaSource('file', `data:image/png;base64,${b64}`)).toBe(false)
    expect(isSafeUrl(`data:audio/mpeg;base64,${b64}`)).toBe(false)
    expect(isSafeUrl(`data:application/pdf;base64,${b64}`)).toBe(false)
  })

  it('refuses active or wildcard-matching types and malformed data URLs', () => {
    for (const kind of ['image', 'video', 'audio', 'file'] as const) {
      expect(isSafeMediaSource(kind, `data:text/html;base64,${b64}`)).toBe(false)
      expect(isSafeMediaSource(kind, `data:image/svg+xml;base64,${b64}`)).toBe(false)
      expect(isSafeMediaSource(kind, 'data:application/javascript,alert(1)')).toBe(false)
      expect(isSafeMediaSource(kind, 'data:,hello')).toBe(false)
    }
    expect(isSafeMediaSource('image', 'data:image/pngx;base64,AAAA')).toBe(false)
    expect(isSafeMediaSource('image', 'data:image/png')).toBe(false)
    expect(isSafeMediaSource('file', 'data:application/pdfx;base64,AAAA')).toBe(false)
  })

  it('keeps data URLs the old check accepted valid for images and video (old stored pages still open)', () => {
    for (const url of ['data:image/jpeg;base64,AAAA', 'data:image/jpg;base64,AAAA', 'data:image/avif;base64,AAAA']) {
      expect(isSafeUrl(url)).toBe(true)
      expect(isSafeMediaSource('image', url)).toBe(true)
    }
    expect(isSafeUrl('data:video/ogg;base64,AAAA')).toBe(true)
    expect(isSafeMediaSource('video', 'data:video/ogg;base64,AAAA')).toBe(true)
  })
})
