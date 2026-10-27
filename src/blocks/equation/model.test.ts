import { describe, expect, it } from 'vitest'
import { parse, safeParse } from 'zod/v4/core'
import { equationSchema, equationTemplate } from './model'

describe('equation model', () => {
  it('template satisfies the schema', () => expect(safeParse(equationSchema, equationTemplate()).success).toBe(true))

  it('keeps the latex source, allows empty, and strips unknown keys', () => {
    expect(parse(equationSchema, { latex: 'E = mc^2', extra: 1 })).toEqual({ latex: 'E = mc^2' })
    expect(safeParse(equationSchema, { latex: '' }).success).toBe(true)
  })

  it('rejects non-string latex and non-object props', () => {
    expect(safeParse(equationSchema, { latex: 3 }).success).toBe(false)
    expect(safeParse(equationSchema, 'nope').success).toBe(false)
  })
})
