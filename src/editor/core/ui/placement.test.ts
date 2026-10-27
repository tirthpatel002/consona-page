import { describe, expect, it } from 'vitest'
import { placeFloating } from './placement'

const viewport = { width: 1000, height: 800 }
const floating = { width: 200, height: 300 }

describe('placeFloating', () => {
  it('keeps the preferred side when the element fits below', () => {
    const anchor = { top: 100, bottom: 130, left: 100, right: 140 }
    const placement = placeFloating(anchor, floating, viewport)
    expect(placement.side).toBe('bottom')
    expect(placement.top).toBe(130 + 6)
    expect(placement.left).toBe(100)
    expect(placement.maxHeight).toBe(800 - 130 - 6 - 8)
  })

  it('flips above only when it does not fit below but fits above', () => {
    const anchor = { top: 560, bottom: 590, left: 100, right: 140 }
    // space below = 800-590-6-8 = 196 < 300; space above = 560-6-8 = 546 >= 300
    const placement = placeFloating(anchor, floating, viewport)
    expect(placement.side).toBe('top')
    expect(placement.top).toBe(560 - 6 - 300)
  })

  it('stays on the preferred side with a constrained height when neither side fits and it is roomier', () => {
    const anchor = { top: 300, bottom: 330, left: 100, right: 140 }
    const tall = { width: 200, height: 700 }
    // below: 800-330-6-8 = 456; above: 300-6-8 = 286. Below is roomier.
    const placement = placeFloating(anchor, tall, viewport)
    expect(placement.side).toBe('bottom')
    expect(placement.maxHeight).toBe(456)
    expect(placement.top).toBe(336)
  })

  it('flips to the roomier side when the preferred side is unusably small', () => {
    const anchor = { top: 660, bottom: 690, left: 100, right: 140 }
    const tall = { width: 200, height: 700 }
    // below: 800-690-6-8 = 96 (< minHeight 120); above: 660-6-8 = 646.
    const placement = placeFloating(anchor, tall, viewport)
    expect(placement.side).toBe('top')
    expect(placement.maxHeight).toBe(646)
    expect(placement.top).toBe(660 - 6 - 646)
  })

  it('honours a top preference symmetrically', () => {
    const anchor = { top: 500, bottom: 530, left: 100, right: 140 }
    const placement = placeFloating(anchor, floating, viewport, { prefer: 'top' })
    expect(placement.side).toBe('top')
    expect(placement.top).toBe(500 - 6 - 300)
  })

  it('clamps horizontally to the viewport', () => {
    const anchor = { top: 100, bottom: 130, left: 950, right: 990 }
    const placement = placeFloating(anchor, floating, viewport)
    expect(placement.left).toBe(1000 - 200 - 8)
    const offscreenLeft = placeFloating({ ...anchor, left: -50 }, floating, viewport)
    expect(offscreenLeft.left).toBe(8)
  })
})
