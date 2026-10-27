import { describe, expect, it } from 'vitest'
import { askOtherTabs, refuseIfOtherTabsDirty, startTabResponder } from './tabCoordination'

const name = () => 'test-' + Math.random().toString(36).slice(2)

describe('tab coordination', () => {
  it('counts other tabs and which are dirty', async () => {
    const channel = name()
    const clean = startTabResponder(() => false, channel)
    const dirty = startTabResponder(() => true, channel)
    const answer = await askOtherTabs(150, channel)
    expect(answer).toEqual({ tabs: 2, dirty: 1 })
    expect(refuseIfOtherTabsDirty(answer)).toMatch(/unsaved/)
    clean.stop()
    dirty.stop()
  })

  it('allows when every other tab is clean, and when there are none', async () => {
    const channel = name()
    const only = startTabResponder(() => false, channel)
    expect(refuseIfOtherTabsDirty(await askOtherTabs(150, channel))).toBeNull()
    only.stop()
    expect(refuseIfOtherTabsDirty(await askOtherTabs(100, name()))).toBeNull()
  })

  it('refuses when tabs cannot be asked at all', () => {
    expect(refuseIfOtherTabsDirty(null)).toMatch(/could not be checked/)
  })
})
