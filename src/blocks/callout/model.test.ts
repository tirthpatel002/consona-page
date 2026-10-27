import { describe, expect, it } from 'vitest'
import { parse, safeParse } from 'zod/v4/core'
import { CALLOUT_VARIANTS, calloutActions, calloutSchema, calloutTemplate } from './model'

describe('callout model', () => {
  it('template satisfies the schema', () => expect(safeParse(calloutSchema, calloutTemplate()).success).toBe(true))

  it('defaults the variant, keeps title optional and strips unknown keys', () => {
    expect(parse(calloutSchema, { body: 'Hi', extra: 1 })).toEqual({ variant: 'info', body: 'Hi' })
  })

  it('rejects an empty body, an unknown variant and non-object props', () => {
    const empty = safeParse(calloutSchema, { body: '' })
    expect(empty.error?.issues.map((i) => i.message)).toEqual(['Callout body is required'])
    expect(safeParse(calloutSchema, { variant: 'loud', body: 'x' }).success).toBe(false)
    expect(safeParse(calloutSchema, 'nope').success).toBe(false)
  })

  it('has one valid action per variant that sets it', () => {
    const props = calloutTemplate()
    expect(calloutActions.map((a) => a.apply(props).variant)).toEqual([...CALLOUT_VARIANTS])
    for (const action of calloutActions) expect(safeParse(calloutSchema, action.apply(props)).success).toBe(true)
  })

  it('marks the current variant in the action label', () => {
    const labels = calloutActions.map((a) => (typeof a.label === 'function' ? a.label(calloutTemplate()) : a.label))
    expect(labels[0]).toBe('✓ Style: info')
    expect(labels[1]).toBe('Style: success')
  })
})
