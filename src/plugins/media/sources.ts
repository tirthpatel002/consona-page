import { isSafeMediaSource, isSafeUrl } from '../../editor/core'

export type MediaKind = 'image' | 'video' | 'audio' | 'file' | 'embed' | 'bookmark'
export const MEDIA_KINDS: readonly MediaKind[] = ['image', 'video', 'audio', 'file', 'embed', 'bookmark']

export const asKind = (value: unknown): MediaKind => MEDIA_KINDS.find((k) => k === value) ?? 'image'

const DATA_MIME = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)?(?:;[^,]*)?,/i

/** MIME type of a data URL, or null when it is not a data URL. */
export function dataMime(src: string): string | null {
  const match = DATA_MIME.exec(src.trim())
  return match ? (match[1] ?? 'application/octet-stream').toLowerCase() : null
}

/** True when the MIME type may be stored in a file block. */
export const isAllowedFileMime = (mime: string): boolean => isSafeMediaSource('file', `data:${mime};base64,`)

const EMBED_SRC = /^https:\/\/(?:www\.youtube-nocookie\.com\/embed\/[\w-]{11}|player\.vimeo\.com\/video\/\d{1,12})$/

/** True only for the exact embed addresses this editor creates (never an arbitrary iframe source). */
export const isEmbedSrc = (src: string): boolean => EMBED_SRC.test(src)

/** A media source the schema accepts for this kind: allowlisted schemes and data types only, else false. */
export function isSafeMediaSrc(kind: MediaKind, src: unknown): src is string {
  if (typeof src !== 'string') return false
  const value = src.trim()
  if (value === '') return false
  if (kind === 'embed') return isEmbedSrc(value)
  // A bookmark is a plain link card: only an http(s) address, never data or relative sources.
  if (kind === 'bookmark') return /^https?:\/\/\S+$/i.test(value) && isSafeUrl(value)
  // One central policy decides every non-embed source (data types per kind, http(s), relative paths).
  return isSafeMediaSource(kind, value)
}

export const isHttpUrl = (src: string): boolean => /^https?:\/\//i.test(src.trim()) && isSafeUrl(src)

/** A link target for the media link: http(s) or mailto only. */
export const isSafeLink = (value: unknown): value is string =>
  typeof value === 'string' && /^(?:https?:\/\/|mailto:)\S+$/i.test(value.trim()) && isSafeUrl(value)

export interface EmbedInfo {
  readonly provider: 'youtube' | 'vimeo'
  /** The canonical player address stored in the document. */
  readonly src: string
  /** The page a person would open. */
  readonly original: string
}

/** Recognises a YouTube or Vimeo address (watch, short, embed forms) and returns its canonical embed. */
export function parseEmbedUrl(input: string): EmbedInfo | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (host === 'youtu.be' || host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    const id =
      host === 'youtu.be'
        ? parts[0]
        : parts[0] === 'watch'
          ? url.searchParams.get('v')
          : parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live'
            ? parts[1]
            : null
    if (id && /^[\w-]{11}$/.test(id)) {
      return {
        provider: 'youtube',
        src: `https://www.youtube-nocookie.com/embed/${id}`,
        original: `https://www.youtube.com/watch?v=${id}`,
      }
    }
    return null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    const id = host === 'player.vimeo.com' ? parts[1] : parts[0]
    if (id && /^\d{1,12}$/.test(id)) {
      return { provider: 'vimeo', src: `https://player.vimeo.com/video/${id}`, original: `https://vimeo.com/${id}` }
    }
  }
  return null
}

/** The page address behind a stored embed source, or '' when it is not an allowlisted embed. */
export function embedOriginal(src: string): string {
  const info = isEmbedSrc(src) ? parseEmbedUrl(src) : null
  return info?.original ?? ''
}

export const EMBED_PROVIDER_NAMES = 'YouTube or Vimeo'

/** Short label for a size in bytes, e.g. "1.4 MB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export const SHAPES = ['none', 'square', 'circle', 'wide', 'portrait'] as const
export type MediaShape = (typeof SHAPES)[number]
export const asShape = (value: unknown): MediaShape => SHAPES.find((s) => s === value) ?? 'none'

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
export const asZoom = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, 1, 3) : 1
export const asFocus = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(Math.round(value), 0, 100) : 50
