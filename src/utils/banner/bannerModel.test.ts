// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  brightnessOfHex,
  clampPercent,
  clampZoom,
  effectiveBannerWidth,
  parseBannerRecord,
  textColorForBrightness,
  truncateTitle,
} from './bannerModel'

describe('banner model', () => {
  it('picks black text on a light fill and white text on a dark fill', () => {
    expect(textColorForBrightness(brightnessOfHex('#F5F5F5') ?? 0)).toBe('#000000')
    expect(textColorForBrightness(brightnessOfHex('#141E30') ?? 0)).toBe('#FFFFFF')
    expect(textColorForBrightness(brightnessOfHex('linear-gradient(to right, #2C3E50, #3498DB)') ?? 0)).toBe('#FFFFFF')
  })

  it('keeps the cover at least half the header wide', () => {
    expect(effectiveBannerWidth(1)).toBe(100)
    expect(effectiveBannerWidth(2)).toBe(50)
    expect(effectiveBannerWidth(4)).toBe(50)
  })

  it('clamps pan and zoom to the source banner limits', () => {
    expect(clampPercent(-10)).toBe(0)
    expect(clampPercent(140)).toBe(100)
    expect(clampZoom(0)).toBe(0.2)
    expect(clampZoom(3)).toBe(2)
  })

  it('truncates the title the same way', () => {
    expect(truncateTitle('Page')).toBe('Page')
    expect(truncateTitle('A very long document name')).toBe('A very long document...')
  })

  it('drops a stored record it cannot read', () => {
    expect(parseBannerRecord(null).banner).toBeNull()
    expect(parseBannerRecord('{').banner).toBeNull()
    expect(
      parseBannerRecord(JSON.stringify({ banner: { type: 'color', value: '#ffffff' }, hidden: true })).banner,
    ).toEqual({
      type: 'color',
      value: '#ffffff',
    })
  })
})
