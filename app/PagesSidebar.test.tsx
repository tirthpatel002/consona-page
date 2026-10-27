// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRegistryStorage, createMemoryStore, createPageRegistry } from '../src/editor/core'
const data = vi.hoisted(() => ({
  registry: null as ReturnType<typeof createPageRegistry> | null,
  pages: null as ReturnType<typeof createMemoryStore> | null,
}))
vi.mock('./demoSession', () => ({
  get demoRegistry() {
    return data.registry
  },
  get demoPages() {
    return data.pages
  },
}))
import { PagesSidebar } from './PagesSidebar'

let host: HTMLDivElement
let root: Root
const settle = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 5))
  })
}
const button = (label: string) => {
  const found = [...host.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === label)
  if (!found) throw new Error(`No button ${label}`)
  return found
}
const click = async (label: string) => {
  await act(async () => {
    button(label).click()
  })
  await settle()
}
const render = async (currentId: string, onCurrentTrashed = vi.fn()) => {
  await act(async () => {
    root.render(
      <PagesSidebar
        currentId={currentId}
        version={1}
        onOpen={() => undefined}
        onChanged={() => undefined}
        onCurrentTrashed={onCurrentTrashed}
      />,
    )
  })
  await settle()
}

beforeEach(() => {
  data.pages = createMemoryStore()
  data.registry = createPageRegistry({ storage: createMemoryRegistryStorage(), pages: data.pages })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe('page sidebar', () => {
  it('moves parent and current child out of view together when the ancestor is trashed', async () => {
    await data.registry?.create({ id: 'p', title: 'Parent' })
    await data.registry?.create({ id: 'c', parentId: 'p', title: 'Child' })
    const leave = vi.fn()
    await render('c', leave)
    await click('Move Parent to trash')
    expect(leave).toHaveBeenCalledWith(null)
  })
  it('does not navigate away when a different subtree is trashed', async () => {
    await data.registry?.create({ id: 'p', title: 'Parent' })
    await data.registry?.create({ id: 'c', title: 'Other' })
    const leave = vi.fn()
    await render('c', leave)
    await click('Move Parent to trash')
    expect(leave).not.toHaveBeenCalled()
  })
  it('Escape cancels rename and a following blur cannot save it', async () => {
    await data.registry?.create({ id: 'p', title: 'Original' })
    await render('p')
    await click('Rename Original')
    const input = host.querySelector<HTMLInputElement>('.pages-rename')
    if (!input) throw new Error('No input')
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    await settle()
    expect(host.querySelector('.pages-rename')).toBeNull()
    expect((await data.registry?.get('p'))?.title).toBe('Original')
  })
  it('move targets exclude self and descendants and reorder controls respect edges', async () => {
    await data.registry?.create({ id: 'p', title: 'Parent' })
    await data.registry?.create({ id: 'c', title: 'Child', parentId: 'p' })
    await data.registry?.create({ id: 'other', title: 'Other' })
    await render('p')
    expect(button('Move Parent up').disabled).toBe(true)
    expect(button('Move Parent down').disabled).toBe(false)
    await click('Move Parent')
    const options = [...host.querySelectorAll('option')].map((o) => o.value)
    expect(options).toEqual(['', 'other'])
  })
})
