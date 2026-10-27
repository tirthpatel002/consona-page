import { describe, expect, it } from 'vitest'
import { safeParse, type $ZodType } from 'zod/v4/core'
import { breadcrumbSchema } from '../../src/blocks/breadcrumb/model'
import { calloutSchema } from '../../src/blocks/callout/model'
import { equationSchema } from '../../src/blocks/equation/model'
import { mermaidSchema } from '../../src/blocks/mermaid/model'
import { tabsSchema } from '../../src/blocks/tabs/model'
import { toggleSchema } from '../../src/blocks/toggle/model'
import { createTestEditor } from '../../src/editor/core'
import { pagePlugins } from '../plugins'
import initialDoc from './initial-doc.json'

interface DocNode {
  type: string
  attrs?: { blockType?: string; props?: unknown }
  content?: DocNode[]
}

// Embed block type ids → props schemas (mirrors embed blocks in app/plugins.ts).
const embedSchemas: Record<string, $ZodType> = {
  breadcrumb: breadcrumbSchema,
  callout: calloutSchema,
  equation: equationSchema,
  mermaid: mermaidSchema,
  tabs: tabsSchema,
  toggle: toggleSchema,
}

const all = (node: DocNode): DocNode[] => [node, ...(node.content ?? []).flatMap(all)]
const nodes = all(initialDoc as DocNode)
const embeds = nodes.filter((n) => n.type === 'embedBlock')

describe('initial document', () => {
  it('includes every registered embed block and key native nodes', () => {
    expect(new Set(embeds.map((b) => b.attrs?.blockType))).toEqual(new Set(Object.keys(embedSchemas)))
    expect(nodes.some((n) => n.type === 'table')).toBe(true)
    expect(nodes.some((n) => n.type === 'card')).toBe(true)
    expect(nodes.some((n) => n.type === 'columnList')).toBe(true)
    expect(nodes.some((n) => n.type === 'media')).toBe(true)
    expect(nodes.some((n) => n.type === 'taskList')).toBe(true)
    expect(nodes.some((n) => n.type === 'codeBlock')).toBe(true)
  })

  it('parses against the live editor schema', () => {
    const { editor, destroy } = createTestEditor({ plugins: [...pagePlugins], content: initialDoc })
    expect(editor.state.doc.content.childCount).toBeGreaterThan(0)
    destroy()
  })

  it.each(embeds.map((b, i) => [`${i}:${b.attrs?.blockType}`, b] as const))('%s has valid props', (_label, block) => {
    const schema = embedSchemas[block.attrs?.blockType ?? '']
    expect(schema).toBeDefined()
    const result = schema ? safeParse(schema, block.attrs?.props) : undefined
    expect(result?.error?.issues ?? []).toEqual([])
  })
})
