import { useEffect, useRef, useState } from 'react'
import { Popover } from '../../editor/core'
import { EmojiPicker } from '../../plugins/emoji/EmojiPicker'
import { BannerPicker } from './BannerPicker'
import { GradientFill } from './GradientFill'
import { gradientById } from '../gradients'
import {
  DEFAULT_BANNER_POSITION,
  DEFAULT_BANNER_ZOOM,
  MAX_BANNER_ZOOM,
  MIN_BANNER_ZOOM,
  brightnessOfHex,
  clampPercent,
  clampZoom,
  effectiveBannerWidth,
  loadBannerRecord,
  saveBannerRecord,
  textColorForBrightness,
  truncateTitle,
  type BannerFill,
  type BannerPoint,
} from './bannerModel'

const REST_TEXT = '#6C6B6B'

const zoomFromPointer = (clientY: number, track: DOMRect): number => {
  const y = Math.max(track.top, Math.min(clientY, track.bottom))
  const inverted = 1 - (y - track.top) / track.height
  return clampZoom(MIN_BANNER_ZOOM + inverted * (MAX_BANNER_ZOOM - MIN_BANNER_ZOOM))
}

const sampleImageBrightness = (img: HTMLImageElement): number | null => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx || img.width === 0 || img.height === 0) return null
  canvas.width = img.width
  canvas.height = img.height
  ctx.drawImage(img, 0, 0)
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, canvas.width, Math.max(1, Math.floor(canvas.height / 3))).data
  } catch {
    return null
  }
  let total = 0
  for (let i = 0; i < data.length; i += 4) total += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
  return total / (data.length / 4)
}

export function PageBanner({ documentId, title }: { readonly documentId: string; readonly title: string }) {
  const [stored] = useState(() => loadBannerRecord(documentId))
  const [banner, setBanner] = useState<BannerFill | null>(stored.banner)
  const [hidden, setHidden] = useState(stored.hidden)
  const [emoji, setEmoji] = useState<string | null>(stored.emoji)
  const icon = stored.icon
  const [position, setPosition] = useState<BannerPoint>(
    stored.banner?.type === 'image' ? (stored.banner.position ?? DEFAULT_BANNER_POSITION) : DEFAULT_BANNER_POSITION,
  )
  const [zoom, setZoom] = useState(
    stored.banner?.type === 'image' ? (stored.banner.zoom ?? DEFAULT_BANNER_ZOOM) : DEFAULT_BANNER_ZOOM,
  )
  const [repositioning, setRepositioning] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [draggingZoom, setDraggingZoom] = useState(false)
  const [imageLoading, setImageLoading] = useState(stored.banner?.type === 'image')
  const [imageInk, setImageInk] = useState<string | null>(null)
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null)
  const [emojiAnchor, setEmojiAnchor] = useState<DOMRect | null>(null)
  const dragStart = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null)
  const snapshot = useRef<{ position: BannerPoint; zoom: number } | null>(null)
  const rootRef = useRef<HTMLElement>(null)

  const showBanner = banner !== null && !hidden
  const imageSrc = banner?.type === 'image' ? banner.value : null

  useEffect(() => {
    saveBannerRecord(documentId, { banner, hidden, emoji, icon })
  }, [documentId, banner, hidden, emoji, icon])

  useEffect(() => {
    if (!imageSrc) return
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      const brightness = sampleImageBrightness(img)
      setImageInk(brightness === null ? REST_TEXT : textColorForBrightness(brightness))
      setImageLoading(false)
    }
    img.onerror = () => {
      if (cancelled) return
      setImageLoading(false)
      setImageInk(REST_TEXT)
    }
    img.src = imageSrc
    return () => {
      cancelled = true
    }
  }, [imageSrc])

  useEffect(() => {
    const node = rootRef.current
    if (!node || !repositioning) return
    const onWheel = (event: WheelEvent) => event.preventDefault()
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [repositioning])

  const cancelEdit = () => {
    if (snapshot.current) {
      setPosition(snapshot.current.position)
      setZoom(snapshot.current.zoom)
    }
    snapshot.current = null
    setRepositioning(false)
    setDragging(false)
    setDraggingZoom(false)
    dragStart.current = null
  }

  const startEdit = () => {
    if (hidden) setHidden(false)
    setRepositioning(true)
    snapshot.current = { position: { ...position }, zoom }
    dragStart.current = null
    setDragging(false)
    setDraggingZoom(false)
  }

  const saveEdit = () => {
    if (banner?.type === 'image') setBanner({ ...banner, position, zoom })
    snapshot.current = null
    setRepositioning(false)
    setDragging(false)
    setDraggingZoom(false)
    dragStart.current = null
  }

  const selectBanner = (next: BannerFill) => {
    const apply = () => {
      setBanner(next)
      setHidden(false)
      setPickerAnchor(null)
    }
    if (next.type !== 'image') {
      setImageLoading(false)
      apply()
      return
    }
    setImageLoading(true)
    const img = new Image()
    img.onload = () => apply()
    img.onerror = () => setImageLoading(false)
    img.src = next.value
  }

  const cover = banner?.type === 'gradient' ? gradientById(banner.value) : undefined
  const solidBrightness = banner && banner.type !== 'image' && !cover ? brightnessOfHex(banner.value) : null
  const fillInk = cover
    ? cover.text
    : banner?.type === 'image'
      ? (imageInk ?? REST_TEXT)
      : solidBrightness === null
        ? REST_TEXT
        : textColorForBrightness(solidBrightness)
  // Cover ink follows the media; collapsed chrome uses page foreground so the title owns the stack above the toolbar.
  const ink = showBanner ? fillInk : undefined
  const width = effectiveBannerWidth(zoom)

  return (
    <header
      ref={rootRef}
      className={`app-banner${showBanner ? ' is-open' : ''}${repositioning ? ' is-editing' : ''}${dragging ? ' is-dragging' : ''}`}
      onPointerDown={(event) => {
        if (!repositioning || draggingZoom) return
        if ((event.target as HTMLElement).closest('button, a, input, form')) return
        event.preventDefault()
        setDragging(true)
        dragStart.current = { x: event.clientX, y: event.clientY, originX: position.x, originY: position.y }
      }}
      onPointerMove={(event) => {
        if (!dragStart.current || !repositioning || !dragging || draggingZoom) return
        event.preventDefault()
        const start = dragStart.current
        setPosition({
          x: clampPercent(start.originX + ((start.x - event.clientX) / window.innerWidth) * 100),
          y: clampPercent(start.originY + ((start.y - event.clientY) / window.innerHeight) * 100),
        })
      }}
      onPointerUp={() => {
        setDragging(false)
        dragStart.current = null
      }}
      onPointerLeave={() => {
        setDragging(false)
        dragStart.current = null
      }}
    >
      {showBanner && (
        <div
          className="app-banner__media"
          style={{
            left: `${(100 - width - position.x) / 2}%`,
            width: `${width}%`,
            ...(cover
              ? {}
              : banner.type === 'image'
                ? {
                    backgroundImage: `url(${banner.value})`,
                    backgroundPosition: `${position.x}% ${position.y}%`,
                    filter: imageLoading ? 'blur(10px)' : 'none',
                  }
                : banner.type === 'gradient'
                  ? { background: banner.value }
                  : { backgroundColor: banner.value }),
          }}
        >
          {cover && <GradientFill gradient={cover} full />}
        </div>
      )}
      {showBanner && repositioning && (
        <div className="app-banner__edit" onPointerDown={(event) => event.stopPropagation()}>
          <p className="app-banner__hint">
            {`Zoom: ${(zoom * 100).toFixed(0)}%`}
            <span>Drag the handle on the right to zoom. Drag the banner to reposition the image.</span>
          </p>
          <div className="app-banner__tools">
            <button type="button" className="app-banner__reset" onClick={() => setZoom(DEFAULT_BANNER_ZOOM)}>
              reset zoom
            </button>
            <div
              className="app-banner__zoom"
              onPointerDown={(event) => {
                const track = event.currentTarget.querySelector('.app-banner__zoom-track')
                if (!(track instanceof HTMLElement)) return
                event.currentTarget.setPointerCapture(event.pointerId)
                event.preventDefault()
                event.stopPropagation()
                setDraggingZoom(true)
                setZoom(zoomFromPointer(event.clientY, track.getBoundingClientRect()))
              }}
              onPointerMove={(event) => {
                if (!draggingZoom) return
                const track = event.currentTarget.querySelector('.app-banner__zoom-track')
                if (!(track instanceof HTMLElement)) return
                event.preventDefault()
                event.stopPropagation()
                setZoom(zoomFromPointer(event.clientY, track.getBoundingClientRect()))
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId)
                }
                setDraggingZoom(false)
              }}
            >
              <span>{Math.round(zoom * 100)}%</span>
              <div className="app-banner__zoom-track">
                <div
                  className="app-banner__zoom-thumb"
                  style={{
                    transform: `translateY(${((MAX_BANNER_ZOOM - zoom) / (MAX_BANNER_ZOOM - MIN_BANNER_ZOOM)) * 70}px)`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="app-banner__content">
        <div className="app-banner__identity">
          {icon && <img className="app-banner__icon" src={icon} alt="" />}
          <h1 style={ink ? { color: ink } : undefined}>
            {emoji && <span className="app-banner__emoji">{emoji}</span>}
            {truncateTitle(title)}
          </h1>
        </div>
        <div className="app-banner__actions">
          <button
            type="button"
            style={ink ? { color: ink } : undefined}
            onClick={(event) => setPickerAnchor(event.currentTarget.getBoundingClientRect())}
          >
            {banner ? 'Change banner' : 'Add banner'}
          </button>
          {banner && (
            <button
              type="button"
              style={ink ? { color: ink } : undefined}
              onClick={() => {
                if (!hidden) cancelEdit()
                setHidden((current) => !current)
              }}
            >
              {hidden ? 'Show banner' : 'Hide banner'}
            </button>
          )}
          {banner?.type === 'image' && showBanner && (
            <button
              type="button"
              className={repositioning ? 'is-active' : undefined}
              style={ink ? { color: ink } : undefined}
              onClick={startEdit}
            >
              {repositioning ? 'Editing banner' : 'Edit banner'}
            </button>
          )}
          {banner?.type === 'image' && showBanner && repositioning && (
            <>
              <button type="button" style={ink ? { color: ink } : undefined} onClick={saveEdit}>
                Save
              </button>
              <button type="button" style={ink ? { color: ink } : undefined} onClick={cancelEdit}>
                Cancel
              </button>
            </>
          )}
          <button
            type="button"
            style={ink ? { color: ink } : undefined}
            onClick={(event) => setEmojiAnchor(event.currentTarget.getBoundingClientRect())}
          >
            Add emoji
          </button>
        </div>
      </div>
      {pickerAnchor && (
        <BannerPicker anchor={pickerAnchor} onClose={() => setPickerAnchor(null)} onSelect={selectBanner} />
      )}
      {emojiAnchor && (
        <Popover anchor={emojiAnchor} onClose={() => setEmojiAnchor(null)} label="Emoji">
          <EmojiPicker
            close={() => setEmojiAnchor(null)}
            onSelect={(next) => {
              setEmoji(next)
              setEmojiAnchor(null)
            }}
          />
        </Popover>
      )}
    </header>
  )
}
