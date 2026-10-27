import { describe, expect, it } from 'vitest'
import { allTableActions, cellMergeAction, tableMenus } from './tableActions'

describe('cellMergeAction', () => {
  it.each([
    [true, false, 'merge'],
    [true, true, 'merge'],
    [false, true, 'split'],
    [false, false, null],
  ] as const)('canMerge=%s canSplit=%s → %s', (canMerge, canSplit, expected) => {
    expect(cellMergeAction(canMerge, canSplit)).toBe(expected)
  })
})

describe('toolbar layout', () => {
  it('groups actions into Add / Remove / Sort menus', () => {
    expect(tableMenus.map((m) => [m.label, m.sections.map((s) => s.map((a) => a.label))])).toEqual([
      ['Add', [['Row above', 'Row below', 'Column left', 'Column right']]],
      ['Remove', [['Row', 'Column'], ['Delete table']]],
      ['Sort', [['Ascending (A→Z)', 'Descending (Z→A)']]],
    ])
  })

  it('has unique action ids and only Delete table is destructive', () => {
    const ids = allTableActions.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(allTableActions.filter((a) => a.danger).map((a) => a.id)).toEqual(['delete-table'])
  })
})
