import { describe, expect, it } from 'vitest'
import { parse, safeParse } from 'zod/v4/core'
import { mermaidSchema, mermaidTemplate } from './model'

describe('mermaid model', () => {
  it('template satisfies the schema', () => expect(safeParse(mermaidSchema, mermaidTemplate()).success).toBe(true))

  it('keeps the source, allows empty, and strips unknown keys', () => {
    expect(parse(mermaidSchema, { source: 'flowchart LR\n A-->B', extra: 1 })).toEqual({
      source: 'flowchart LR\n A-->B',
    })
    expect(safeParse(mermaidSchema, { source: '' }).success).toBe(true)
  })

  it('rejects non-string source and non-object props', () => {
    expect(safeParse(mermaidSchema, { source: 3 }).success).toBe(false)
    expect(safeParse(mermaidSchema, 'nope').success).toBe(false)
  })
})
