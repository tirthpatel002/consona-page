// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryRegistryStorage, createMemoryStore, createPageRegistry } from '../../editor/core'
import { ChildPagePreviews } from './index'

const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 5))
  })

describe('child preview exclusions', () => {
  it('excludes before the limit, does not read excluded bodies, and responds to changing references', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    const pages = createMemoryStore()
    const registry = createPageRegistry({ storage: createMemoryRegistryStorage(), pages })
    await registry.create({ id: 'parent' })
    for (let i = 0; i < 52; i++) await registry.create({ id: `p${i}`, parentId: 'parent', title: `Child ${i}` })
    const get = vi.spyOn(pages, 'get')
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const render = (excludeIds: ReadonlySet<string>) =>
      act(async () => {
        root.render(
          <ChildPagePreviews
            registry={registry}
            pages={pages}
            parentId="parent"
            excludeIds={excludeIds}
            onOpen={() => undefined}
          />,
        )
      })
    try {
      await render(new Set(['p0', 'p1']))
      await settle()
      expect(host.querySelectorAll('.page-preview')).toHaveLength(50)
      expect(get).not.toHaveBeenCalledWith('p0')
      expect(get).not.toHaveBeenCalledWith('p1')
      expect(host.textContent).toContain('Child 51')
      expect(host.textContent).not.toContain('Showing the first 50')
      await render(new Set())
      await settle()
      expect(host.textContent).toContain('Showing the first 50')
      expect(get).toHaveBeenCalledWith('p0')
      await render(new Set(Array.from({ length: 52 }, (_, i) => `p${i}`)))
      await settle()
      expect(host.querySelector('.page-previews')).toBeNull()
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })
})
