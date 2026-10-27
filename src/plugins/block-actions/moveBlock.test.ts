import { Schema } from '@tiptap/pm/model'
import { describe, expect, it } from 'vitest'
import { planMove } from './moveBlock'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'text*' },
    embed: { group: 'block', atom: true },
    text: {},
  },
})

// doc: [p("ab")=4, embed=1, p("c")=3]  → positions 0, 4, 5
const doc = schema.node('doc', null, [
  schema.node('paragraph', null, [schema.text('ab')]),
  schema.node('embed'),
  schema.node('paragraph', null, [schema.text('c')]),
])

describe('planMove', () => {
  it('moves a block up past its previous sibling', () => {
    expect(planMove(doc, 4, 'up')).toEqual({ from: 4, to: 5, insertAt: 0 })
  })

  it('moves a block down past its next sibling', () => {
    expect(planMove(doc, 4, 'down')).toEqual({ from: 4, to: 5, insertAt: 7 })
  })

  it('returns null at the edges or for invalid positions', () => {
    expect(planMove(doc, 0, 'up')).toBeNull()
    expect(planMove(doc, 5, 'down')).toBeNull()
    expect(planMove(doc, 999, 'up')).toBeNull()
  })

  it('produces a valid document when applied', () => {
    const plan = planMove(doc, 4, 'down')
    const node = doc.nodeAt(4)
    if (!plan || !node) throw new Error('expected a plan')
    const removed = doc.cut(0, plan.from).content.append(doc.cut(plan.to).content)
    const result = schema.node('doc', null, removed).replace(plan.insertAt, plan.insertAt, doc.slice(4, 5))
    expect(result.child(2).type.name).toBe('embed')
  })
})
