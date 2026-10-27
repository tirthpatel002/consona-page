import { describe, expect, it } from 'vitest'
import { GUTTER_LANE_WIDTH, LANE_HYSTERESIS_PX, keepsAnchorInLane } from './blockGeometry'

const rect = { left: 200, top: 100, bottom: 124 }

describe('keepsAnchorInLane (A2)', () => {
  it('keeps the anchor in the lane beside the block', () => {
    expect(keepsAnchorInLane(rect, 200 - 20, 112)).toBe(true)
  })
  it('keeps the anchor when a diagonal path clips a few pixels past the block edge', () => {
    expect(keepsAnchorInLane(rect, 200 - 20, 100 - LANE_HYSTERESIS_PX + 1)).toBe(true)
    expect(keepsAnchorInLane(rect, 200 - 20, 124 + LANE_HYSTERESIS_PX - 1)).toBe(true)
  })
  it('lets the anchor move on past the hysteresis band', () => {
    expect(keepsAnchorInLane(rect, 200 - 20, 100 - LANE_HYSTERESIS_PX - 1)).toBe(false)
    expect(keepsAnchorInLane(rect, 200 - 20, 124 + LANE_HYSTERESIS_PX + 1)).toBe(false)
  })
  it('does not hold the anchor over the block content or beyond the lane', () => {
    expect(keepsAnchorInLane(rect, 200, 112)).toBe(false)
    expect(keepsAnchorInLane(rect, 200 - GUTTER_LANE_WIDTH - 1, 112)).toBe(false)
  })
})
