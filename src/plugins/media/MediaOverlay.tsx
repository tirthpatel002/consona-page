import type { Editor } from '@tiptap/core'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Icon, lucideStrokeForSize, Popover } from '../../editor/core'
import {
  chooseFileAccept,
  fileBlockMime,
  kindOfAny,
  kindOfFile,
  kindOfUrl,
  MAX_EMBED_BYTES,
  readAsDataUrl,
} from './files'
import { insertMedia, setMediaDetails, setMediaSource } from './operations'
import { closePanel, panelStore, type MediaPanel } from './panelStore'
import {
  asKind,
  EMBED_PROVIDER_NAMES,
  isHttpUrl,
  isSafeLink,
  parseEmbedUrl,
  SHAPES,
  type MediaKind,
  type MediaShape,
} from './sources'

const KIND_TITLE: Readonly<Record<MediaKind, string>> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  file: 'file',
  embed: 'video',
}

const SHAPE_LABEL: Readonly<Record<MediaShape, string>> = {
  none: 'Original',
  square: 'Square',
  circle: 'Circle',
  wide: 'Wide',
  portrait: 'Portrait',
}

const rectOf = (editor: Editor, panel: MediaPanel): DOMRect => {
  if ('pos' in panel) {
    const dom = editor.view.nodeDOM(panel.pos)
    if (dom instanceof HTMLElement) return dom.getBoundingClientRect()
  }
  try {
    const at = panel.type === 'insert' && panel.at !== undefined ? panel.at : editor.state.selection.from
    const caret = editor.view.coordsAtPos(at)
    return new DOMRect(caret.left, caret.top, 0, caret.bottom - caret.top)
  } catch {
    return editor.view.dom.getBoundingClientRect()
  }
}

/** Puts the caret back in the page after a panel closes through the keyboard. */
const restoreFocus = (editor: Editor) => {
  if (!editor.isDestroyed) editor.view.focus()
}

/** All media panels. Mounted once as a plugin overlay; renders nothing while no panel is open. */
export function MediaOverlay() {
  const current = useSyncExternalStore(panelStore.subscribe, panelStore.get, panelStore.get)
  const anchor = useMemo(() => (current ? rectOf(current.editor, current.panel) : null), [current])
  if (!current || !anchor) return null
  const { editor, panel } = current
  const close = (refocus = true) => {
    closePanel()
    if (refocus) restoreFocus(editor)
  }
  if (panel.type === 'fullscreen') return <Fullscreen editor={editor} pos={panel.pos} onClose={close} />
  const label =
    panel.type === 'insert' || panel.type === 'replace'
      ? `${panel.type === 'insert' ? 'Add' : 'Replace'} ${KIND_TITLE[panel.kind]}`
      : panel.type === 'alt'
        ? 'Alt text'
        : panel.type === 'link'
          ? 'Image link'
          : 'Crop image'
  return (
    <Popover key={JSON.stringify(panel)} anchor={anchor} label={label} onClose={() => close(false)}>
      <div className="page-media-panel" onKeyDown={(event) => event.key === 'Escape' && restoreFocus(editor)}>
        {panel.type === 'insert' || panel.type === 'replace' ? (
          <SourcePanel editor={editor} panel={panel} onDone={close} />
        ) : panel.type === 'crop' ? (
          <CropPanel editor={editor} pos={panel.pos} onDone={close} />
        ) : (
          <TextPanel editor={editor} panel={panel} onDone={close} />
        )}
      </div>
    </Popover>
  )
}

/* ---------------------------------------------------------------- upload and link */

function SourcePanel({
  editor,
  panel,
  onDone,
}: {
  readonly editor: Editor
  readonly panel: Extract<MediaPanel, { type: 'insert' | 'replace' }>
  readonly onDone: () => void
}) {
  const kind: MediaKind = panel.kind === 'embed' ? 'video' : panel.kind
  const [tab, setTab] = useState(panel.tab)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const urlInput = useRef<HTMLInputElement>(null)
  const ids = useId()
  const busy = progress !== null

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    if (tab === 'link') urlInput.current?.focus()
    else fileInput.current?.focus()
  }, [tab])

  const apply = (target: MediaKind, src: string, extras: { name?: string; size?: number | null } = {}) => {
    const ok =
      panel.type === 'replace'
        ? setMediaSource.run(editor, panel.pos, src, target, extras)
        : insertMedia.run(editor, target, src, panel.at, { showCaption: false, ...extras })
    if (!ok) {
      setError('That source cannot be used here.')
      return false
    }
    onDone()
    return true
  }

  const accept = async (file: File) => {
    setError('')
    const detected = kindOfAny(file)
    const wrongType =
      kind === 'file'
        ? fileBlockMime(file) === null
        : (kind === 'image' || kind === 'video' || kind === 'audio') && kindOfFile(file) !== kind
    if (detected === null || wrongType) {
      setError(
        kind === 'file'
          ? `${file.name || 'This file'} is not a type that can be stored in a page.`
          : `${file.name || 'This file'} is not ${kind === 'image' ? 'an image (PNG, JPEG, GIF, WebP or AVIF)' : kind === 'video' ? 'a video (MP4, WebM or Ogg)' : 'an audio file'}.`,
      )
      return
    }
    if (file.size > MAX_EMBED_BYTES) {
      setError(`${file.name} is larger than ${MAX_EMBED_BYTES / 1024 / 1024} MB.`)
      return
    }
    const controller = new AbortController()
    abort.current = controller
    setProgress(0)
    const result = await readAsDataUrl(file, { onProgress: setProgress, signal: controller.signal })
    abort.current = null
    if (controller.signal.aborted) return
    setProgress(null)
    if (!result.ok) {
      setError(result.reason)
      return
    }
    apply(kind, result.src, kind === 'file' ? { name: result.name, size: result.size } : {})
  }

  const cancel = () => {
    abort.current?.abort()
    abort.current = null
    setProgress(null)
    setError('Upload cancelled.')
  }

  const submitLink = () => {
    const value = url.trim()
    setError('')
    if (!isHttpUrl(value)) return setError('Enter a link that starts with https:// or http://.')
    if (kind === 'video') {
      const embed = parseEmbedUrl(value)
      if (embed) return void apply('embed', embed.src)
      if (kindOfUrl(value) !== 'video') {
        return setError(`Use a ${EMBED_PROVIDER_NAMES} link, or a direct link to an .mp4, .webm or .ogg file.`)
      }
      return void apply('video', value)
    }
    if (kind === 'file') {
      const name = decodeURIComponent(value.split(/[?#]/)[0].split('/').pop() ?? '') || 'File'
      return void apply('file', value, { name, size: null })
    }
    apply(kind, value)
  }

  const onTabKey = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    setTab((t) => (t === 'upload' ? 'link' : 'upload'))
  }

  return (
    <>
      <div className="page-media-panel__tabs" role="tablist" aria-label="Source" onKeyDown={onTabKey}>
        {(['upload', 'link'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`${ids}-${id}`}
            aria-selected={tab === id}
            aria-controls={`${ids}-panel`}
            tabIndex={tab === id ? 0 : -1}
            disabled={busy}
            onClick={() => {
              setError('')
              setTab(id)
            }}
          >
            {id === 'upload' ? 'Upload' : 'Embed link'}
          </button>
        ))}
      </div>
      <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-${tab}`} className="page-media-panel__body">
        {tab === 'upload' ? (
          busy ? (
            <div className="page-media-panel__progress">
              <progress max={1} value={progress ?? 0} aria-label="Upload progress" />
              <span aria-live="polite">{Math.round((progress ?? 0) * 100)}%</span>
              <button type="button" onClick={cancel}>
                Cancel
              </button>
            </div>
          ) : (
            <div
              className="page-media-panel__drop"
              data-dragging={dragging || undefined}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                const file = event.dataTransfer.files[0]
                if (file) void accept(file)
              }}
            >
              <input
                ref={fileInput}
                type="file"
                accept={chooseFileAccept(kind)}
                aria-label={`Choose ${KIND_TITLE[kind]} file`}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void accept(file)
                }}
              />
              <p>Or drop a file here. Up to {MAX_EMBED_BYTES / 1024 / 1024} MB.</p>
            </div>
          )
        ) : (
          <form
            className="page-media-panel__form"
            onSubmit={(event) => {
              event.preventDefault()
              submitLink()
            }}
          >
            <input
              ref={urlInput}
              type="url"
              inputMode="url"
              value={url}
              placeholder={
                kind === 'video' ? `Paste a ${EMBED_PROVIDER_NAMES} or video link` : `Paste a ${KIND_TITLE[kind]} link`
              }
              aria-label={`${KIND_TITLE[kind]} link`}
              aria-invalid={error ? true : undefined}
              onChange={(event) => setUrl(event.target.value)}
            />
            <button type="submit" disabled={url.trim() === ''}>
              {panel.type === 'replace' ? 'Replace' : 'Embed'}
            </button>
          </form>
        )}
        {error ? (
          <p className="page-media-panel__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- alt text and link */

function TextPanel({
  editor,
  panel,
  onDone,
}: {
  readonly editor: Editor
  readonly panel: Extract<MediaPanel, { type: 'alt' | 'link' }>
  readonly onDone: () => void
}) {
  const isAlt = panel.type === 'alt'
  const initial = String(editor.state.doc.nodeAt(panel.pos)?.attrs[isAlt ? 'alt' : 'link'] ?? '')
  const [value, setValue] = useState(initial)
  const [error, setError] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.select(), [])
  const save = (next: string) => {
    const trimmed = next.trim()
    if (!isAlt && trimmed !== '' && !isSafeLink(trimmed)) {
      return setError('Enter a link that starts with https://, http:// or mailto:.')
    }
    setMediaDetails.run(editor, panel.pos, isAlt ? { alt: trimmed } : { link: trimmed })
    onDone()
  }
  return (
    <form
      className="page-media-panel__form page-media-panel__form--stack"
      onSubmit={(event) => {
        event.preventDefault()
        save(value)
      }}
    >
      <label>
        <span>{isAlt ? 'Describe this image for people who cannot see it' : 'Link for this image'}</span>
        <input
          ref={ref}
          type={isAlt ? 'text' : 'url'}
          value={value}
          maxLength={isAlt ? 300 : 2000}
          placeholder={isAlt ? 'A short description' : 'https://'}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      {error ? (
        <p className="page-media-panel__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="page-media-panel__actions">
        {initial ? (
          <button type="button" onClick={() => save('')}>
            Remove
          </button>
        ) : null}
        <button type="submit">Save</button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------- crop */

function CropPanel({
  editor,
  pos,
  onDone,
}: {
  readonly editor: Editor
  readonly pos: number
  readonly onDone: () => void
}) {
  const node = editor.state.doc.nodeAt(pos)
  const attrs = node?.attrs ?? {}
  const [shape, setShape] = useState<MediaShape>((attrs.shape as MediaShape) ?? 'none')
  const [zoom, setZoom] = useState(Number(attrs.zoom ?? 1))
  const [x, setX] = useState(Number(attrs.focusX ?? 50))
  const [y, setY] = useState(Number(attrs.focusY ?? 50))
  const ids = useId()
  const style = { '--media-zoom': zoom, '--media-x': `${x}%`, '--media-y': `${y}%` } as React.CSSProperties
  const range = (
    label: string,
    id: string,
    value: number,
    min: number,
    max: number,
    step: number,
    set: (v: number) => void,
  ) => (
    <label htmlFor={`${ids}-${id}`} className="page-media-panel__range">
      <span>{label}</span>
      <input
        id={`${ids}-${id}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => set(Number(event.target.value))}
      />
    </label>
  )
  return (
    <div className="page-media-panel__crop">
      <div className="page-media-crop" data-shape={shape} data-zoom={zoom !== 1 ? zoom : undefined} style={style}>
        <img src={String(attrs.src ?? '')} alt="" draggable={false} />
      </div>
      <div className="page-media-panel__shapes" role="group" aria-label="Shape">
        {SHAPES.map((id) => (
          <button key={id} type="button" aria-pressed={shape === id} onClick={() => setShape(id)}>
            {SHAPE_LABEL[id]}
          </button>
        ))}
      </div>
      {range('Zoom', 'zoom', zoom, 1, 3, 0.1, setZoom)}
      {range('Horizontal position', 'x', x, 0, 100, 1, setX)}
      {range('Vertical position', 'y', y, 0, 100, 1, setY)}
      <div className="page-media-panel__actions">
        <button
          type="button"
          onClick={() => {
            setShape('none')
            setZoom(1)
            setX(50)
            setY(50)
          }}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => {
            setMediaDetails.run(editor, pos, { shape, zoom, focusX: x, focusY: y })
            onDone()
          }}
        >
          Apply
        </button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- full screen */

function Fullscreen({
  editor,
  pos,
  onClose,
}: {
  readonly editor: Editor
  readonly pos: number
  readonly onClose: () => void
}) {
  const attrs = editor.state.doc.nodeAt(pos)?.attrs
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === ' ') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'Tab') {
        event.preventDefault()
        closeRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = previous
    }
  }, [onClose])
  if (!attrs || asKind(attrs.kind) !== 'image') return null
  const style = {
    '--media-zoom': Number(attrs.zoom ?? 1),
    '--media-x': `${Number(attrs.focusX ?? 50)}%`,
    '--media-y': `${Number(attrs.focusY ?? 50)}%`,
  } as React.CSSProperties
  const dialog: ReactNode = (
    <div className="page-media-lightbox" role="presentation">
      <button
        type="button"
        className="page-media-lightbox__backdrop"
        aria-label="Close full screen"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={String(attrs.alt || 'Image')}
        className="page-media-lightbox__panel"
      >
        <button
          ref={closeRef}
          type="button"
          className="page-media-lightbox__close"
          title="Close"
          aria-label="Close full screen"
          onClick={onClose}
        >
          <Icon name="close" size={16} strokeWidth={lucideStrokeForSize(16, 2)} />
        </button>
        <div className="page-media-crop" data-shape={String(attrs.shape ?? 'none')} style={style}>
          <img src={String(attrs.src)} alt={String(attrs.alt ?? '')} />
        </div>
        {attrs.alt ? <p>{String(attrs.alt)}</p> : null}
      </div>
    </div>
  )
  return createPortal(dialog, document.body)
}
