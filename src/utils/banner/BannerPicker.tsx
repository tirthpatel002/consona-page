import { useEffect, useRef, useState } from 'react'
import { orderedGradients } from '../gradients'
import { Popover } from '../../editor/core'
import { GradientFill } from './GradientFill'
import { BANNER_COLORS, BANNER_IMAGES } from './catalog'
import type { BannerFill } from './bannerModel'

const PAGE_SIZE = 12

type BannerTab = 'images' | 'colors' | 'gradients'

const preload = (url: string): Promise<string | null> =>
  new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(url)
    img.onerror = () => resolve(null)
    img.src = `${url}?w=300&q=80&auto=format`
  })

export function BannerPicker({
  anchor,
  onClose,
  onSelect,
}: {
  readonly anchor: DOMRect
  readonly onClose: () => void
  readonly onSelect: (banner: BannerFill) => void
}) {
  const [tab, setTab] = useState<BannerTab>('colors')
  const [images, setImages] = useState<readonly string[]>([])
  const [busy, setBusy] = useState(false)
  const [seen, setSeen] = useState(0)
  const [customUrl, setCustomUrl] = useState('')
  const cursor = useRef(0)
  const loading = useRef(false)
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (tab !== 'images') return
    const node = sentinel.current
    if (!node) return
    const loadMore = () => {
      if (loading.current) return
      const start = cursor.current
      const batch = BANNER_IMAGES.slice(start, start + PAGE_SIZE)
      if (batch.length === 0) return
      loading.current = true
      setBusy(true)
      void Promise.all(batch.map(preload)).then((loaded) => {
        cursor.current = start + batch.length
        setSeen(cursor.current)
        setImages((prev) => [...prev, ...loaded.filter((url): url is string => url !== null)])
        loading.current = false
        setBusy(false)
      })
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { threshold: 0.1 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [tab, seen])

  return (
    <Popover anchor={anchor} onClose={onClose} label="Banner">
      <div className="app-banner-picker">
        <div className="app-banner-picker__tabs" role="tablist">
          {(['images', 'colors', 'gradients'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'is-active' : undefined}
              onClick={() => setTab(id)}
            >
              {id}
            </button>
          ))}
        </div>
        <div className="app-banner-picker__body">
          {tab === 'images' && (
            <>
              <div className="app-banner-picker__images">
                {images.map((url) => (
                  <button
                    key={url}
                    type="button"
                    className="app-banner-picker__image"
                    style={{ backgroundImage: `url(${url}?w=300&q=80&auto=format)` }}
                    aria-label="Use this image"
                    onClick={() => onSelect({ type: 'image', value: url })}
                  />
                ))}
                <div ref={sentinel} className="app-banner-picker__sentinel">
                  {busy ? 'Loading more images...' : null}
                </div>
              </div>
              <form
                className="app-banner-picker__url"
                onSubmit={(event) => {
                  event.preventDefault()
                  const url = customUrl.trim()
                  if (!url) return
                  onSelect({ type: 'image', value: url })
                }}
              >
                <input
                  type="url"
                  value={customUrl}
                  placeholder="Custom URL"
                  aria-label="Custom image URL"
                  onChange={(event) => setCustomUrl(event.target.value)}
                />
                <button type="submit">Use URL</button>
              </form>
            </>
          )}
          {tab === 'colors' && (
            <div className="app-banner-picker__colors">
              {BANNER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="app-banner-picker__swatch"
                  style={{ backgroundColor: color }}
                  aria-label={color}
                  onClick={() => onSelect({ type: 'color', value: color })}
                />
              ))}
            </div>
          )}
          {tab === 'gradients' && (
            <div className="app-banner-picker__gradients">
              {orderedGradients().map((gradient, index) => (
                <button
                  key={gradient.id}
                  type="button"
                  className="app-banner-picker__gradient"
                  aria-label={`${index + 1}. ${gradient.name}`}
                  title={`${index + 1}. ${gradient.name}`}
                  onClick={() => onSelect({ type: 'gradient', value: gradient.id })}
                >
                  <GradientFill gradient={gradient} />
                  <span className="app-banner-picker__index">{index + 1}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Popover>
  )
}
