/** URL allowlist shared by import, paste and the schema. */
const SAFE =
  /^(?:https?:|mailto:|tel:|#|\/|\.\.?\/|data:(?:image\/(?:png|jpe?g|gif|webp|avif);|video\/(?:mp4|webm|ogg);))/i

/** True for URLs that are safe to keep from imported content (no javascript:, vbscript:, data:text/html, ...). */
export const isSafeUrl = (url: string): boolean => {
  const value = url.trim()
  return value.length > 0 && (SAFE.test(value) || !/^[a-z][a-z0-9+.-]*:/i.test(value))
}

export type MediaSourceKind = 'image' | 'video' | 'audio' | 'file'

/**
 * Inline `data:` types accepted per media kind. Exact types only, never a wildcard: no SVG (it can carry
 * script), no HTML, no `text/*` except plain text and CSV for downloads. A data URL for one kind is not
 * accepted for another, so an audio or file data URL cannot become an image source or a link.
 */
const DATA_TYPES: Record<MediaSourceKind, string> = {
  image: 'image/(?:png|jpe?g|gif|webp|avif)',
  video: 'video/(?:mp4|webm|ogg)',
  audio: 'audio/(?:mpeg|mp3|wav|x-wav|ogg|webm|mp4|aac)',
  file: '(?:application/pdf|text/plain|text/csv|application/zip)',
}
const DATA_PATTERNS = Object.fromEntries(
  Object.entries(DATA_TYPES).map(([kind, types]) => [kind, new RegExp(`^data:${types}(?:;[a-z0-9=_.+-]+)*,`, 'i')]),
) as Record<MediaSourceKind, RegExp>

/**
 * Whether `url` may be the source of a media block of this kind: a relative path, http(s), or an inline
 * data URL of an allowed type for exactly that kind. Never mailto:, tel:, blob:, javascript: or other schemes.
 * Embeds (YouTube and Vimeo players) are checked by the media plugin against a host allowlist, not here.
 */
export const isSafeMediaSource = (kind: MediaSourceKind, url: string): boolean => {
  const value = url.trim()
  if (value.length === 0) return false
  if (/^data:/i.test(value)) return DATA_PATTERNS[kind].test(value)
  if (/^https?:/i.test(value)) return true
  return !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('#')
}
