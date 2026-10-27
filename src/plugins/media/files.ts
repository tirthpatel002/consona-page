import { type MediaKind, dataMime, isAllowedFileMime } from './sources'

/** Largest file embedded in the document as a data URL (there is no upload backend yet). */
export const MAX_EMBED_BYTES = 8 * 1024 * 1024

const IMAGE_URL = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|avif)(?:\?\S*)?$/i
const VIDEO_URL = /^https?:\/\/\S+\.(?:mp4|webm|ogg|mov)(?:\?\S*)?$/i
const AUDIO_URL = /^https?:\/\/\S+\.(?:mp3|wav|m4a|aac|flac|oga|ogg)(?:\?\S*)?$/i

/** Media kind for a bare URL (by extension), or null. */
export function kindOfUrl(text: string): MediaKind | null {
  const url = text.trim()
  if (IMAGE_URL.test(url)) return 'image'
  if (VIDEO_URL.test(url)) return 'video'
  if (AUDIO_URL.test(url)) return 'audio'
  return null
}

/** Media kind for a file (by MIME type), or null. Documents are not media; see `fileBlockKind`. */
export function kindOfFile(file: { type: string }): MediaKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return null
}

const EXT_MIME: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  json: 'application/json',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rtf: 'application/rtf',
}

/** The MIME type a file block would store, or null when the type is not allowed (web pages, scripts, SVG). */
export function fileBlockMime(file: { type: string; name: string }): string | null {
  const declared = file.type.toLowerCase()
  if (declared && declared !== 'application/octet-stream') return isAllowedFileMime(declared) ? declared : null
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? ''
  return EXT_MIME[ext] ?? (declared === 'application/octet-stream' ? declared : null)
}

/** What a dropped or chosen file becomes: its media kind, else a file block when the type is allowed. */
export function kindOfAny(file: { type: string; name: string }): MediaKind | null {
  const media = kindOfFile(file)
  if (media) return media
  return fileBlockMime(file) ? 'file' : null
}

export type ReadResult =
  { ok: true; src: string; name: string; size: number } | { ok: false; reason: string; cancelled?: boolean }

export interface ReadOptions {
  readonly onProgress?: (fraction: number) => void
  readonly signal?: AbortSignal
}

/** Reads a file into a data URL, refusing files over the embed limit. Reports progress and can be cancelled. */
export function readAsDataUrl(file: File, options: ReadOptions = {}): Promise<ReadResult> {
  if (file.size > MAX_EMBED_BYTES) {
    return Promise.resolve({ ok: false, reason: `${file.name} is larger than ${MAX_EMBED_BYTES / 1024 / 1024} MB` })
  }
  return new Promise((resolve) => {
    const reader = new FileReader()
    const { signal, onProgress } = options
    const onAbort = () => reader.abort()
    signal?.addEventListener('abort', onAbort)
    const done = (result: ReadResult) => {
      signal?.removeEventListener('abort', onAbort)
      resolve(result)
    }
    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total)
    }
    reader.onload = () => {
      let src = String(reader.result)
      // Some browsers leave the type empty; keep the declared (or extension) type so the source passes the allowlist.
      if (dataMime(src) === 'application/octet-stream' && !/^data:application\/octet-stream/i.test(src)) {
        const mime = fileBlockMime(file)
        if (mime) src = src.replace(/^data:[^,;]*/i, `data:${mime}`)
      }
      onProgress?.(1)
      done({ ok: true, src, name: file.name, size: file.size })
    }
    reader.onabort = () => done({ ok: false, reason: 'Cancelled', cancelled: true })
    reader.onerror = () => done({ ok: false, reason: `Could not read ${file.name}` })
    if (signal?.aborted) return done({ ok: false, reason: 'Cancelled', cancelled: true })
    reader.readAsDataURL(file)
  })
}

export const ACCEPT: Readonly<Record<MediaKind, string>> = {
  image: 'image/png,image/jpeg,image/gif,image/webp,image/avif',
  video: 'video/mp4,video/webm,video/ogg',
  audio: 'audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4,audio/aac,audio/flac',
  file: '',
  embed: '',
}

/** Opens the system file chooser for a kind. */
export function chooseFile(kind: MediaKind): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = ACCEPT[kind]
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}

/** The `accept` list for a file input of this kind (empty = any type; the type is checked after choosing). */
export const chooseFileAccept = (kind: MediaKind): string => ACCEPT[kind]
