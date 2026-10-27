export interface BannerPoint {
  readonly x: number
  readonly y: number
}

export type BannerFill =
  | { readonly type: 'image'; readonly value: string; readonly position?: BannerPoint; readonly zoom?: number }
  | { readonly type: 'gradient'; readonly value: string }
  | { readonly type: 'color'; readonly value: string }

export interface BannerRecord {
  readonly banner: BannerFill | null
  readonly hidden: boolean
  readonly emoji: string | null
  readonly icon: string | null
}

export const DEFAULT_BANNER_POSITION: BannerPoint = { x: 0, y: 50 }
export const DEFAULT_BANNER_ZOOM = 1
export const MIN_BANNER_ZOOM = 0.2
export const MAX_BANNER_ZOOM = 2
export const MIN_BANNER_WIDTH = 50
export const EMPTY_BANNER: BannerRecord = { banner: null, hidden: false, emoji: null, icon: null }

/** Cover width as a percentage of the header. Zooming in shrinks the painted area, matching the source banner. */
export const effectiveBannerWidth = (zoom: number): number => Math.max(MIN_BANNER_WIDTH, 100 / zoom)

export const clampPercent = (value: number): number => Math.max(0, Math.min(100, value))

export const clampZoom = (zoom: number): number => Math.max(MIN_BANNER_ZOOM, Math.min(MAX_BANNER_ZOOM, zoom))

/** Perceived brightness, 0–255. Text flips at 128, the same threshold as the source banner. */
export const textColorForBrightness = (brightness: number): '#000000' | '#FFFFFF' =>
  brightness > 128 ? '#000000' : '#FFFFFF'

/** First #rrggbb in a solid colour or a gradient string. */
export const brightnessOfHex = (value: string): number | null => {
  const match = /#[0-9a-fA-F]{6}/.exec(value)
  if (!match) return null
  const hex = match[0]
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000
}

export const truncateTitle = (title: string): string => (title.length > 20 ? `${title.slice(0, 20)}...` : title)

const isPoint = (value: unknown): value is BannerPoint => {
  if (typeof value !== 'object' || value === null) return false
  const point = value as { x?: unknown; y?: unknown }
  return typeof point.x === 'number' && typeof point.y === 'number'
}

const parseFill = (value: unknown): BannerFill | null => {
  if (typeof value !== 'object' || value === null) return null
  const fill = value as { type?: unknown; value?: unknown; position?: unknown; zoom?: unknown }
  if (typeof fill.value !== 'string' || fill.value.length === 0) return null
  if (fill.type === 'image') {
    return {
      type: 'image',
      value: fill.value,
      ...(isPoint(fill.position) ? { position: fill.position } : {}),
      ...(typeof fill.zoom === 'number' ? { zoom: fill.zoom } : {}),
    }
  }
  if (fill.type === 'gradient' || fill.type === 'color') return { type: fill.type, value: fill.value }
  return null
}

export const parseBannerRecord = (raw: string | null): BannerRecord => {
  if (!raw) return EMPTY_BANNER
  try {
    const parsed = JSON.parse(raw) as { banner?: unknown; hidden?: unknown; emoji?: unknown; icon?: unknown }
    return {
      banner: parseFill(parsed.banner),
      hidden: parsed.hidden === true,
      emoji: typeof parsed.emoji === 'string' && parsed.emoji.length > 0 ? parsed.emoji : null,
      icon: typeof parsed.icon === 'string' && parsed.icon.length > 0 ? parsed.icon : null,
    }
  } catch {
    return EMPTY_BANNER
  }
}

export const bannerStorageKey = (documentId: string): string => `page:banner:${documentId}`

export const loadBannerRecord = (documentId: string): BannerRecord => {
  try {
    return parseBannerRecord(localStorage.getItem(bannerStorageKey(documentId)))
  } catch {
    return EMPTY_BANNER
  }
}

export const saveBannerRecord = (documentId: string, record: BannerRecord): void => {
  try {
    localStorage.setItem(bannerStorageKey(documentId), JSON.stringify(record))
  } catch {
    // Private mode and quota failures leave the in-memory banner in place.
  }
}
