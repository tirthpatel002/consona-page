import { getSchema, type JSONContent } from '@tiptap/core'
import { CellSelection } from '@tiptap/pm/tables'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import type { Node as PMNode } from '@tiptap/pm/model'
import { EditorState, TextSelection, type Transaction } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { sortTableByColumn } from './sortTable'
import { hasRowSpans, isInHeaderRow, leadingHeaderRows } from './tableQueries'

const schema = getSchema([StarterKit, Table, TableRow, TableHeader, TableCell])

const cell = (type: 'tableCell' | 'tableHeader', text: string, attrs?: Record<string, number>): JSONContent => ({
  type,
  attrs,
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
})
const row = (type: 'tableCell' | 'tableHeader', ...texts: string[]): JSONContent => ({
  type: 'tableRow',
  content: texts.map((text) => cell(type, text)),
})
const docWith = (...rows: JSONContent[]) =>
  schema.nodeFromJSON({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'above' }] },
      { type: 'table', content: rows },
    ],
  })

/** Text of every cell, row by row. */
const grid = (doc: PMNode) => {
  const rows: string[][] = []
  doc.descendants((node) => {
    if (node.type.name === 'tableRow') rows.push([])
    if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') {
      rows.at(-1)?.push(node.textContent)
      return false
    }
    return true
  })
  return rows
}

/** State with the caret inside the cell containing `text`. */
const stateIn = (doc: PMNode, text: string) => {
  let pos = -1
  doc.descendants((node, p) => {
    if (pos < 0 && node.isText && node.text === text) pos = p
  })
  if (pos < 0) throw new Error(`no text ${text}`)
  return EditorState.create({ schema, doc, selection: TextSelection.create(doc, pos + 1) })
}

const defined = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) throw new Error('expected a value')
  return value
}
const tableOf = (doc: PMNode) => defined(doc.lastChild)

const run = (state: EditorState, direction: 'asc' | 'desc') => {
  let tr: Transaction | undefined
  const ok = sortTableByColumn(direction)(state, (next) => {
    tr = next
  })
  return { ok, tr }
}

const sample = docWith(
  row('tableHeader', 'Account', 'ARR'),
  row('tableCell', 'Acme', '420'),
  row('tableCell', 'Globex', '64'),
  row('tableCell', 'Initech', '1,020'),
)

describe('sortTableByColumn', () => {
  it('sorts body rows numerically by the selected column and keeps the header row on top', () => {
    const { ok, tr } = run(stateIn(sample, '420'), 'asc')
    expect(ok).toBe(true)
    expect(tr?.steps).toHaveLength(1) // one step → one undo
    expect(grid(defined(tr).doc)).toEqual([
      ['Account', 'ARR'],
      ['Globex', '64'],
      ['Acme', '420'],
      ['Initech', '1,020'],
    ])
  })

  it('sorts descending by a text column and leaves the caret in that column', () => {
    const { tr } = run(stateIn(sample, 'Globex'), 'desc')
    expect(grid(defined(tr).doc).map((r) => r[0])).toEqual(['Account', 'Initech', 'Globex', 'Acme'])
    expect(defined(tr).selection.$head.parent.textContent).toBe('Account')
  })

  it('keeps cell content (marks) intact', () => {
    const doc = schema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            row('tableCell', 'b'),
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a', marks: [{ type: 'bold' }] }] }],
                },
              ],
            },
          ],
        },
      ],
    })
    const { tr } = run(stateIn(doc, 'b'), 'asc')
    const firstText = defined(tr).doc.firstChild?.firstChild?.firstChild?.firstChild?.firstChild
    expect(firstText?.text).toBe('a')
    expect(firstText?.marks.map((m) => m.type.name)).toEqual(['bold'])
  })

  it('applies but dispatches nothing when already sorted', () => {
    const { ok, tr } = run(stateIn(sample, 'Acme'), 'asc')
    expect(ok).toBe(true)
    expect(tr).toBeUndefined()
  })

  it('is not applicable outside a table, with fewer than 2 body rows, or with row spans', () => {
    expect(run(stateIn(sample, 'above'), 'asc').ok).toBe(false)
    expect(run(stateIn(docWith(row('tableHeader', 'H'), row('tableCell', 'x')), 'x'), 'asc').ok).toBe(false)

    const spanned = docWith(
      { type: 'tableRow', content: [cell('tableCell', 'a', { rowspan: 2 }), cell('tableCell', 'b')] },
      row('tableCell', 'c'),
    )
    expect(hasRowSpans(tableOf(spanned))).toBe(true)
    expect(run(stateIn(spanned, 'b'), 'asc').ok).toBe(false)
  })
})

describe('leadingHeaderRows', () => {
  it('counts only leading all-header rows', () => {
    expect(leadingHeaderRows(tableOf(sample))).toBe(1)
    expect(leadingHeaderRows(tableOf(docWith(row('tableCell', 'a'), row('tableHeader', 'b'))))).toBe(0)
  })
})

describe('isInHeaderRow', () => {
  const doc = docWith(row('tableHeader', 'Name', 'Score'), row('tableCell', 'b', '2'), row('tableCell', 'a', '1'))

  it('is true in a header cell and false in body cells or outside the table', () => {
    expect(isInHeaderRow(stateIn(doc, 'Score'))).toBe(true)
    expect(isInHeaderRow(stateIn(doc, 'b'))).toBe(false)
    expect(isInHeaderRow(stateIn(doc, 'above'))).toBe(false)
  })

  it('does not count header cells of a header column in body rows', () => {
    const columnHeaders = docWith(
      { type: 'tableRow', content: [cell('tableHeader', 'k1'), cell('tableCell', 'v1')] },
      { type: 'tableRow', content: [cell('tableHeader', 'k2'), cell('tableCell', 'v2')] },
    )
    expect(isInHeaderRow(stateIn(columnHeaders, 'k1'))).toBe(false)
  })

  it('follows the head cell of a CellSelection', () => {
    const cellStart = (text: string) => stateIn(doc, text).selection.$head.before(-1)
    const inHeader = EditorState.create({
      schema,
      doc,
      selection: CellSelection.create(doc, cellStart('b'), cellStart('Name')),
    })
    expect(isInHeaderRow(inHeader)).toBe(true)
    const inBody = EditorState.create({
      schema,
      doc,
      selection: CellSelection.create(doc, cellStart('Name'), cellStart('a')),
    })
    expect(isInHeaderRow(inBody)).toBe(false)
  })
})
