import { describe, expect, it } from 'vitest'
import { parsePropsInput } from './parsePropsInput'

describe('parsePropsInput', () => {
  it('accepts JSON objects', () => expect(parsePropsInput('{"a":1}')).toEqual({ ok: true, props: { a: 1 } }))
  it('rejects invalid JSON with a message', () => {
    const result = parsePropsInput('{a:')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/^Invalid JSON/)
  })
  it.each(['[]', '1', 'null', '"x"'])('rejects non-object %s', (text) => {
    expect(parsePropsInput(text)).toEqual({ ok: false, error: 'Props must be a JSON object' })
  })
})
