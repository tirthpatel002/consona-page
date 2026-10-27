import { describe, expect, it, vi } from 'vitest'
import * as z from 'zod/mini'
import { defineBlock, formatIssues } from './defineBlock'
import type { BlockRenderContext } from './types'

const schema = z.object({ label: z.string().check(z.minLength(1)), count: z._default(z.int(), 1) })
type Props = z.infer<typeof schema>

let lastContext: BlockRenderContext<Props> | undefined
const host = () => ({ editable: true, updateProps: vi.fn(), selectBlock: vi.fn() })

const block = defineBlock<Props>({
  type: 'counter',
  title: 'Counter',
  schema,
  template: () => ({ label: 'Clicks', count: 0 }),
  render: (props, ctx) => {
    lastContext = ctx
    return `${props.label}: ${props.count}`
  },
  actions: [{ id: 'inc', label: (p) => `Increment (${p.count})`, apply: (p) => ({ ...p, count: p.count + 1 }) }],
})

describe('defineBlock', () => {
  it('creates JSON props from the template', () => {
    expect(block.createProps()).toEqual({ label: 'Clicks', count: 0 })
  })

  it('defaults presentation to inset feedback', () => {
    expect(block.presentation).toEqual({ feedback: 'inset' })
  })

  it('honors presentation.feedback from the definition', () => {
    const shell = defineBlock({
      type: 'panel',
      title: 'Panel',
      presentation: { feedback: 'shell' },
      schema,
      template: () => ({ label: 'X', count: 0 }),
      render: () => null,
    })
    expect(shell.presentation).toEqual({ feedback: 'shell' })
  })

  it('validates props, applying defaults and stripping unknown keys', () => {
    const result = block.validate({ label: 'Hi', extra: true })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.render(host())).toBe('Hi: 1')
  })

  it('render context validates updates before writing JSON props', () => {
    const h = host()
    const result = block.validate({ label: 'A', count: 1 })
    if (!result.ok) throw new Error('expected valid')
    result.render(h)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(lastContext?.update({ label: 'B', count: 2 })).toBe(true)
    expect(h.updateProps).toHaveBeenCalledWith({ label: 'B', count: 2 })
    expect(lastContext?.update({ label: '', count: 2 })).toBe(false)
    expect(h.updateProps).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('reports readable issues for invalid props', () => {
    const result = block.validate({ label: '', count: 'x' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues).toHaveLength(2)
      expect(result.issues[0]).toMatch(/^label: /)
      expect(result.issues[1]).toMatch(/^count: /)
    }
  })

  it('resolves actions against validated props and returns JSON', () => {
    const [action] = block.actionsFor({ label: 'A', count: 2 })
    expect(action?.label).toBe('Increment (2)')
    expect(action?.apply()).toEqual({ label: 'A', count: 3 })
    expect(block.actionsFor({ label: '' })).toEqual([])
  })

  it('rejects invalid block types', () => {
    expect(() =>
      defineBlock({
        ...{ title: 'x', schema, template: () => ({ label: 'a', count: 1 }), render: () => null },
        type: '1 bad',
      }),
    ).toThrow(/Invalid block type/)
  })

  it('formats root-level issues', () => {
    const result = z.safeParse(z.string(), 1)
    expect(result.success).toBe(false)
    if (!result.success) expect(formatIssues(result.error)[0]).toMatch(/^\(root\): /)
  })
})
