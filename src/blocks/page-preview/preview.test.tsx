// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createMemoryRegistryStorage, createMemoryStore, createPageRegistry, type JsonObject } from '../../editor/core'
import { previewNodes, readPreview } from './model'
import { PreviewBody } from './PreviewBody'
import { createPagePreviewPlugin } from './plugin'

const setup = () => {
  const pages = createMemoryStore()
  const registry = createPageRegistry({ storage: createMemoryRegistryStorage(), pages })
  return { pages, registry }
}
const doc = (content: unknown[]): JsonObject => ({ type: 'doc', content }) as JsonObject

describe('page previews', () => {
  it('reads an authoritative child body, changes after the store changes, and never writes a parent', async () => {
    const { pages, registry } = setup()
    await registry.create({ id: 'parent', title: 'Parent' })
    await registry.create({ id: 'child', parentId: 'parent', title: 'Child' })
    await pages.put('child', doc([{ type: 'heading', content: [{ type: 'text', text: 'First' }] }]))
    expect(JSON.stringify(await readPreview(registry, pages, 'child', 'parent'))).toContain('First')
    await pages.put('child', doc([{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }]))
    expect(JSON.stringify(await readPreview(registry, pages, 'child', 'parent'))).toContain('Second')
    expect(await pages.get('parent')).toBeNull()
  })
  it('handles empty, missing, trashed, ancestor-trashed and self references without editable fallback', async () => {
    const { pages, registry } = setup()
    expect(await readPreview(registry, pages, 'missing')).toEqual({ status: 'missing' })
    await registry.create({ id: 'p' })
    await registry.create({ id: 'c', parentId: 'p' })
    expect(await readPreview(registry, pages, 'c')).toMatchObject({ status: 'ready', nodes: [] })
    expect(await readPreview(registry, pages, 'p', 'p')).toEqual({ status: 'cycle' })
    await registry.moveToTrash('p')
    expect(await readPreview(registry, pages, 'p')).toEqual({ status: 'trashed' })
    expect(await readPreview(registry, pages, 'c')).toEqual({ status: 'trashed' })
  })
  it('does not swallow a storage failure into a fake empty page', async () => {
    const { registry, pages } = setup()
    await registry.create({ id: 'p' })
    await expect(
      readPreview(
        registry,
        {
          ...pages,
          get: async () => {
            throw new Error('offline')
          },
        },
        'p',
      ),
    ).rejects.toThrow('offline')
  })
  it('bounds depth, node count and text before rendering', () => {
    const paragraph = { type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(10000) }] }
    const result = previewNodes(doc(Array(200).fill(paragraph)))
    expect(result.length).toBeLessThanOrEqual(12)
    expect(JSON.stringify(result).length).toBeLessThan(6000)
    let deep: unknown = paragraph
    for (let i = 0; i < 100; i++) deep = { type: 'column', content: [deep] }
    expect(JSON.stringify(previewNodes(doc([deep])))).not.toContain('xxxx')
  })
  it('renders actual blocks and formatting but never active URLs, iframe, unsafe image or raw HTML', () => {
    const nodes = previewNodes(
      doc([
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [
            {
              type: 'text',
              text: '<script>bad</script>',
              marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'javascript:bad()' } }],
            },
          ],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell' }] }] },
              ],
            },
          ],
        },
        {
          type: 'embedBlock',
          attrs: { blockType: 'callout', props: { body: 'A real callout', title: 'Note', variant: 'neutral' } },
        },
        { type: 'media', attrs: { kind: 'image', src: 'javascript:alert(1)' } },
        { type: 'media', attrs: { kind: 'image', src: 'https://tracker.invalid/pixel' } },
        { type: 'media', attrs: { kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/abcdefghijk' } },
        { type: 'embedBlock', attrs: { blockType: 'pageReference', props: { pageId: 'p' } } },
      ]),
    )
    const html = renderToStaticMarkup(<PreviewBody nodes={nodes} />)
    expect(html).toContain('<strong>')
    expect(html).toContain('<table>')
    expect(html).toContain('page-callout')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('inert=""')
    expect(html).not.toMatch(/<script|<iframe|<a |javascript:|tracker.invalid|youtube-nocookie/)
  })
  it('the block persists only an id, validates props and remains passive when locked', () => {
    const { registry, pages } = setup()
    const plugin = createPagePreviewPlugin({ registry, pages, pageId: () => 'p', onOpen: () => undefined })
    const block = plugin.blocks?.[0]
    if (!block) throw new Error('No block')
    expect(block.createProps()).toEqual({ pageId: '' })
    expect(block.validate({ pageId: 2 }).ok).toBe(false)
    const value = block.validate({ pageId: '', body: 'must not survive' })
    expect(value.ok).toBe(true)
    if (value.ok)
      expect(
        renderToStaticMarkup(
          <>{value.render({ editable: false, updateProps: () => undefined, selectBlock: () => undefined })}</>,
        ),
      ).toContain('No page linked')
  })
})
