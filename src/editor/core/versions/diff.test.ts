// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { diffDocs, diffWords } from './diff'

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const h1 = (text: string) => ({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text }] })
const embed = (id: string) => ({ type: 'embedBlock', attrs: { blockType: 'equation', props: { latex: id } } })

describe('E1 diff', () => {
  it('word diff marks added and removed runs', () => {
    expect(diffWords('the quick fox', 'the quick brown fox')).toEqual([
      { text: 'the quick ', kind: 'same' },
      { text: 'brown ', kind: 'added' },
      { text: 'fox', kind: 'same' },
    ])
    expect(diffWords('a b c', 'a c')).toEqual([
      { text: 'a ', kind: 'same' },
      { text: 'b ', kind: 'removed' },
      { text: 'c', kind: 'same' },
    ])
  })

  it('doc diff: same, changed (with words), added and removed blocks', () => {
    const before = { type: 'doc', content: [p('Intro'), p('Revenue grew'), p('Outro')] }
    const after = { type: 'doc', content: [p('Intro'), p('Revenue grew a lot'), h1('New'), p('Outro')] }
    const diff = diffDocs(before, after)
    expect(diff.map((d) => d.kind)).toEqual(['same', 'changed', 'added', 'same'])
    const changed = diff[1]
    expect(changed.words?.some((w) => w.kind === 'added' && w.text.includes('a lot'))).toBe(true)
  })

  it('removed blocks are reported', () => {
    const before = { type: 'doc', content: [p('A'), p('B'), p('C')] }
    const after = { type: 'doc', content: [p('A'), p('C')] }
    expect(diffDocs(before, after).map((d) => d.kind)).toEqual(['same', 'removed', 'same'])
  })

  it('embed changes diff via serialized content, not just text', () => {
    const before = { type: 'doc', content: [embed('x=1')] }
    const after = { type: 'doc', content: [embed('x=2')] }
    const diff = diffDocs(before, after)
    expect(diff[0].kind).not.toBe('same')
  })
})

describe('E3 non-text change visibility', () => {
  it('surfaces marks-only changes instead of hiding them', () => {
    const before = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] }
    const after = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello', marks: [{ type: 'bold' }] }] }],
    }
    const rows = diffDocs(before, after)
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('changed')
    expect(rows[0].note).toBe('formatting changed')
  })

  it('surfaces attr-only changes (block properties)', () => {
    const before = {
      type: 'doc',
      content: [{ type: 'callout', attrs: { variant: 'info' }, content: [{ type: 'text', text: 'Note' }] }],
    }
    const after = {
      type: 'doc',
      content: [{ type: 'callout', attrs: { variant: 'warn' }, content: [{ type: 'text', text: 'Note' }] }],
    }
    const rows = diffDocs(before, after)
    expect(rows[0].kind).toBe('changed')
    expect(rows[0].note).toBe('properties changed')
  })

  it('marks a fully identical doc as all-same (no phantom changes)', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Same', marks: [{ type: 'bold' }] }] }],
    }
    expect(diffDocs(doc, doc).every((row) => row.kind === 'same')).toBe(true)
  })
})
