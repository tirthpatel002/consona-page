// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../src/editor/core'
import { pagePlugins } from './plugins'

describe('bubble toolbar opt-out', () => {
  it('only the media node is bubbleless in the built schema', () => {
    const { editor, destroy } = createTestEditor({ plugins: pagePlugins, content: '<p>x</p>' })
    const flags = Object.entries(editor.schema.nodes)
      .filter(([, type]) => (type.spec as { bubbleless?: boolean }).bubbleless === true)
      .map(([name]) => name)
    expect(flags).toEqual(['media'])
    destroy()
  })
})
