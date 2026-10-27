import type { MediaKind } from './extensions'

/** Largest file embedded in the document as a data URL (there is no upload backend yet). */
export const MAX_EMBED_BYTES = 8 * 1024 * 1024

const IMAGE_URL = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|avif)(?:\?\S*)?$/i
const VIDEO_URL = /^https?:\/\/\S+\.(?:mp4|webm|ogg|mov)(?:\?\S*)?$/i

/** Media kind for a bare URL (by extension), or null. */
export function kindOfUrl(text: string): MediaKind | null {
  const url = text.trim()
  if (IMAGE_URL.test(url)) return 'image'
  if (VIDEO_URL.test(url)) return 'video'
  return null
}

/** Media kind for a file (by MIME type), or null. */
export function kindOfFile(file: { type: string }): MediaKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return null
}

export type ReadResult = { ok: true; src: string } | { ok: false; reason: string }

/** Reads a file into a data URL, refusing files over the embed limit. */
export function readAsDataUrl(file: File): Promise<ReadResult> {
  if (file.size > MAX_EMBED_BYTES) {
    return Promise.resolve({ ok: false, reason: `${file.name} is larger than ${MAX_EMBED_BYTES / 1024 / 1024} MB` })
  }
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ ok: true, src: String(reader.result) })
    reader.onerror = () => resolve({ ok: false, reason: `Could not read ${file.name}` })
    reader.readAsDataURL(file)
  })
}

/** Opens the system file chooser for images or videos. */
export function chooseFile(kind: MediaKind): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = kind === 'image' ? 'image/*' : 'video/*'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}
