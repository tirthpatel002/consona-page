/** URL allowlist shared by import, paste and the schema. */
const SAFE =
  /^(?:https?:|mailto:|tel:|#|\/|\.\.?\/|data:(?:image\/(?:png|jpe?g|gif|webp|avif);|video\/(?:mp4|webm|ogg);))/i

/** True for URLs that are safe to keep from imported content (no javascript:, vbscript:, data:text/html, ...). */
export const isSafeUrl = (url: string): boolean => {
  const value = url.trim()
  return value.length > 0 && (SAFE.test(value) || !/^[a-z][a-z0-9+.-]*:/i.test(value))
}
