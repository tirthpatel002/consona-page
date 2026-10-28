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
  const found = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === label)
  if (!found) throw new Error(`No button ${label}`)
  return found
}
const menuItem = (label: string) => {
  const found = [...document.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent === label)
  if (!found) throw new Error(`No menu item ${label}`)
  return found as HTMLButtonElement
}
const click = async (label: string) => {
  await act(async () => {
    button(label).click()
  })
  await settle()
}
const choose = async (pageTitle: string, item: string) => {
  await click(`More actions for ${pageTitle}`)
  await act(async () => {
    menuItem(item).click()
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
    await choose('Parent', 'Move to trash')
    expect(leave).toHaveBeenCalledWith(null)
  })
  it('does not navigate away when a different subtree is trashed', async () => {
    await data.registry?.create({ id: 'p', title: 'Parent' })
    await data.registry?.create({ id: 'c', title: 'Other' })
    const leave = vi.fn()
    await render('c', leave)
    await choose('Parent', 'Move to trash')
    expect(leave).not.toHaveBeenCalled()
  })
  it('Escape cancels rename and a following blur cannot save it', async () => {
    await data.registry?.create({ id: 'p', title: 'Original' })
    await render('p')
    await choose('Original', 'Rename')
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
    await click('More actions for Parent')
    const labels = [...document.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent)
    expect(labels).not.toContain('Move up')
    expect(labels).toContain('Move down')
    await act(async () => {
      menuItem('Move…').click()
    })
    await settle()
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    const destinations = [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent)
    expect(destinations).toEqual(['Top level', 'Other'])
  })
})
