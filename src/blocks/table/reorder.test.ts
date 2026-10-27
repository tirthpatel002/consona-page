import { getSchema, type JSONContent } from '@tiptap/core'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import type { Node as PMNode } from '@tiptap/pm/model'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { CellSelection } from '@tiptap/pm/tables'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import {
  columnReorderBlocker,
  movedColumnTable,
  movedRowTable,
  reorderTransaction,
  rowReorderBlocker,
  slotForPointer,
  targetIndexForSlot,
} from './reorder'
import { moveColumnBy, moveRowBy } from './tableMoveCommands'

const schema = getSchema([StarterKit, Table, TableRow, TableHeader, TableCell])

type CellType = 'tableCell' | 'tableHeader'
const cell = (type: CellType, text: string, attrs: Record<string, unknown> = {}): JSONContent => ({
  type,
  attrs,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})
const row = (type: CellType, ...texts: string[]): JSONContent => ({
  type: 'tableRow',
  content: texts.map((text, i) => cell(type, text, { colwidth: [100 + i] })),
})
const docWith = (...rows: JSONContent[]) =>
  schema.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph' }, { type: 'table', content: rows }] })

const tableOf = (doc: PMNode): PMNode => {
  const table = doc.lastChild
  if (!table) throw new Error('no table')
  return table
}
const grid = (table: PMNode) => {
  const rows: string[][] = []
  table.forEach((r) => {
    const cells: string[] = []
    r.forEach((c) => cells.push(c.textContent))
    rows.push(cells)
  })
  return rows
}
const widths = (table: PMNode) => {
  const rows: unknown[][] = []
  table.forEach((r) => {
    const cells: unknown[] = []
    r.forEach((c) => cells.push((c.attrs.colwidth as number[] | null)?.[0]))
    rows.push(cells)
  })
  return rows
}
const types = (table: PMNode) => {
  const rows: string[][] = []
  table.forEach((r) => {
    const cells: string[] = []
    r.forEach((c) => cells.push(c.type.name))
    rows.push(cells)
  })
  return rows
}

const sample = () =>
  docWith(row('tableHeader', 'A', 'B', 'C'), row('tableCell', 'a1', 'b1', 'c1'), row('tableCell', 'a2', 'b2', 'c2'))
const tablePos = 2 // an empty paragraph (size 2) precedes the table

const stateAt = (doc: PMNode, text: string) => {
  let pos = -1
  doc.descendants((node, p) => {
    if (pos < 0 && node.isText && node.text === text) pos = p
  })
  return EditorState.create({ schema, doc, selection: TextSelection.create(doc, pos + 1) })
}

describe('slot math', () => {
  it('maps a pointer to the insertion slot and the final index', () => {
    const centers = [50, 150, 250]
    expect(slotForPointer(centers, 10)).toBe(0)
    expect(slotForPointer(centers, 200)).toBe(2)
    expect(slotForPointer(centers, 999)).toBe(3)
    expect(slotForPointer(centers, 10, 1)).toBe(1) // header rows: never above the first body row
    expect(targetIndexForSlot(0, 3)).toBe(2)
    expect(targetIndexForSlot(2, 0)).toBe(0)
    expect(targetIndexForSlot(1, 1)).toBe(1) // dropping next to itself is a no-op
    expect(targetIndexForSlot(1, 2)).toBe(1)
  })
})

describe('column move', () => {
  it('moves a whole column in every row, header cell included, keeping cell types and widths with it', () => {
    const moved = movedColumnTable(tableOf(sample()), 0, 2)
    expect(grid(moved ?? tableOf(sample()))).toEqual([
      ['B', 'C', 'A'],
      ['b1', 'c1', 'a1'],
      ['b2', 'c2', 'a2'],
    ])
    expect(widths(moved as PMNode)).toEqual([
      [101, 102, 100],
      [101, 102, 100],
      [101, 102, 100],
    ])
    expect(types(moved as PMNode)[0]).toEqual(['tableHeader', 'tableHeader', 'tableHeader'])
  })

  it('reuses the same cell nodes (content, attrs and block ids are not rewritten)', () => {
    const table = tableOf(sample())
    const moved = movedColumnTable(table, 2, 0) as PMNode
    expect(moved.child(1).child(0)).toBe(table.child(1).child(2))
  })

  it('is one replace step, selects the moved column and undoes as one step', () => {
    const doc = sample()
    const state = stateAt(doc, 'b1')
    const tr = reorderTransaction(state, tablePos, 'column', 1, 0, { kind: 'cells' })
    expect(tr?.steps).toHaveLength(1)
    expect(tr?.selection).toBeInstanceOf(CellSelection)
    const sel = tr?.selection as CellSelection
    expect(sel.isColSelection()).toBe(true)
    expect(grid(tableOf(tr?.doc as PMNode))[1]).toEqual(['b1', 'a1', 'c1'])
    const inverse = tr?.steps[0]?.invert(doc)
    expect(inverse).toBeDefined()
  })

  it('does nothing for the same index, out-of-range indexes or a non-table position', () => {
    const state = stateAt(sample(), 'a1')
    expect(reorderTransaction(state, tablePos, 'column', 1, 1, { kind: 'cells' })).toBeNull()
    expect(reorderTransaction(state, tablePos, 'column', 0, 3, { kind: 'cells' })).toBeNull()
    expect(reorderTransaction(state, 0, 'column', 0, 1, { kind: 'cells' })).toBeNull()
  })
})

describe('row move', () => {
  it('moves body rows and never moves or passes the header row', () => {
    const table = tableOf(sample())
    expect(grid(movedRowTable(table, 1, 2) as PMNode)).toEqual([
      ['A', 'B', 'C'],
      ['a2', 'b2', 'c2'],
      ['a1', 'b1', 'c1'],
    ])
    expect(movedRowTable(table, 0, 2)).toBeNull() // the header row cannot be picked up
    expect(movedRowTable(table, 2, 0)).toBeNull() // and nothing can be dropped above it
  })

  it('moves any row when the table has no header row', () => {
    const table = tableOf(docWith(row('tableCell', 'x'), row('tableCell', 'y')))
    expect(grid(movedRowTable(table, 1, 0) as PMNode)).toEqual([['y'], ['x']])
  })

  it('selects the moved row as cells', () => {
    const tr = reorderTransaction(stateAt(sample(), 'a1'), tablePos, 'row', 1, 2, { kind: 'cells' })
    expect((tr?.selection as CellSelection).isRowSelection()).toBe(true)
  })
})

describe('merged cells', () => {
  const merged = () =>
    docWith(
      { type: 'tableRow', content: [cell('tableHeader', 'H', { colspan: 2 })] },
      row('tableCell', 'a', 'b'),
      row('tableCell', 'c', 'd'),
    )
  const rowspanned = () =>
    docWith(
      { type: 'tableRow', content: [cell('tableCell', 'a', { rowspan: 2 }), cell('tableCell', 'b')] },
      { type: 'tableRow', content: [cell('tableCell', 'c')] },
      { type: 'tableRow', content: [cell('tableCell', 'd'), cell('tableCell', 'e')] },
    )

  it('refuses column moves when any cell is merged, with a reason, and changes nothing', () => {
    expect(columnReorderBlocker(tableOf(merged()))).toMatch(/merged/)
    expect(movedColumnTable(tableOf(merged()), 0, 1)).toBeNull()
    expect(columnReorderBlocker(tableOf(rowspanned()))).toMatch(/merged/)
  })

  it('refuses row moves when any cell is merged', () => {
    expect(rowReorderBlocker(tableOf(merged()))).toMatch(/merged/)
    expect(movedRowTable(tableOf(rowspanned()), 1, 2)).toBeNull()
  })

  it('allows both on a plain table', () => {
    expect(columnReorderBlocker(tableOf(sample()))).toBeNull()
    expect(rowReorderBlocker(tableOf(sample()))).toBeNull()
  })

  it('needs two columns / two body rows', () => {
    expect(columnReorderBlocker(tableOf(docWith(row('tableCell', 'x'), row('tableCell', 'y'))))).toMatch(/two columns/)
    expect(rowReorderBlocker(tableOf(docWith(row('tableHeader', 'h'), row('tableCell', 'x'))))).toMatch(/two body rows/)
  })
})

describe('keyboard / toolbar commands', () => {
  const run = (state: EditorState, command: ReturnType<typeof moveColumnBy>) => {
    let next: EditorState | undefined
    const ok = command(state, (tr) => {
      next = state.apply(tr)
    })
    return { ok, next }
  }

  it('moves the column one step and keeps the caret in the same cell', () => {
    const { ok, next } = run(stateAt(sample(), 'b1'), moveColumnBy(1))
    expect(ok).toBe(true)
    expect(grid(tableOf((next as EditorState).doc))[1]).toEqual(['a1', 'c1', 'b1'])
    expect((next as EditorState).selection.$head.parent.textContent).toBe('b1')
  })

  it('is disabled at the edges', () => {
    expect(run(stateAt(sample(), 'a1'), moveColumnBy(-1)).ok).toBe(false)
    expect(run(stateAt(sample(), 'c1'), moveColumnBy(1)).ok).toBe(false)
  })

  it('moves a body row but not a header row, and not past the header', () => {
    const { next } = run(stateAt(sample(), 'a2'), moveRowBy(-1))
    expect(grid(tableOf((next as EditorState).doc))).toEqual([
      ['A', 'B', 'C'],
      ['a2', 'b2', 'c2'],
      ['a1', 'b1', 'c1'],
    ])
    expect((next as EditorState).selection.$head.parent.textContent).toBe('a2')
    expect(run(stateAt(sample(), 'a1'), moveRowBy(-1)).ok).toBe(false)
    expect(run(stateAt(sample(), 'A'), moveRowBy(1)).ok).toBe(false)
  })

  it('does not run outside a table', () => {
    const doc = schema.nodeFromJSON({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    })
    expect(run(stateAt(doc, 'x'), moveColumnBy(1)).ok).toBe(false)
  })
})
