import { describe, expect, it } from 'vitest'
import { collectPageReferenceIds } from './pageRefs'

const ref = (pageId: unknown) => ({ type: 'embedBlock', attrs: { blockType: 'pageReference', props: { pageId } } })

describe('collectPageReferenceIds', () => {
  it('finds references at any depth and ignores empty, non-string and other embeds', () => {
    const doc = {
      type: 'doc',
      content: [
        ref('a'),
        { type: 'column', content: [{ type: 'columns', content: [ref('b'), ref(''), ref(3)] }] },
        { type: 'embedBlock', attrs: { blockType: 'other', props: { pageId: 'z' } } },
      ],
    }
    expect([...collectPageReferenceIds(doc)].sort()).toEqual(['a', 'b'])
  })
})
