import { getSchema, type JSONContent } from '@tiptap/core'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import type { Node as PMNode } from '@tiptap/pm/model'
import { EditorState, type Transaction } from '@tiptap/pm/state'
import { columnResizing, columnResizingPluginKey } from '@tiptap/pm/tables'
import type { EditorView } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { headerOnlyResizePlugin } from './headerOnlyResize'
import { isHeaderRowPos } from './tableQueries'

const schema = getSchema([StarterKit, Table, TableRow, TableHeader, TableCell])
const cell = (type: 'tableCell' | 'tableHeader', text: string): JSONContent => ({
  type,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})
const row = (...cells: JSONContent[]): JSONContent => ({ type: 'tableRow', content: cells })
const docOf = (...rows: JSONContent[]) =>
  schema.nodeFromJSON({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'intro' }] },
      { type: 'table', content: rows },
    ],
  })

/** Position directly before the cell whose text is `text`. */
const cellPos = (doc: PMNode, text: string) => {
  let found = -1
  doc.descendants((node, pos) => {
    const role = node.type.spec.tableRole
    if (found < 0 && (role === 'cell' || role === 'header_cell') && node.textContent === text) found = pos
    return found < 0
  })
  if (found < 0) throw new Error(`no cell ${text}`)
  return found
}

const doc = docOf(
  row(cell('tableHeader', 'Name'), cell('tableHeader', 'Score')),
  row(cell('tableHeader', 'k1'), cell('tableCell', 'v1')),
)

describe('isHeaderRowPos', () => {
  it('is true before or inside a header-row cell', () => {
    expect(isHeaderRowPos(doc.resolve(cellPos(doc, 'Score')))).toBe(true)
    expect(isHeaderRowPos(doc.resolve(cellPos(doc, 'Score') + 2))).toBe(true)
  })

  it('is false for body cells, header-column cells in body rows, and outside tables', () => {
    expect(isHeaderRowPos(doc.resolve(cellPos(doc, 'v1')))).toBe(false)
    expect(isHeaderRowPos(doc.resolve(cellPos(doc, 'k1') + 2))).toBe(false)
    expect(isHeaderRowPos(doc.resolve(2))).toBe(false)
  })

  it('is false everywhere when the table has no header row', () => {
    const plain = docOf(row(cell('tableCell', 'a'), cell('tableCell', 'b')))
    expect(isHeaderRowPos(plain.resolve(cellPos(plain, 'a')))).toBe(false)
  })
})

describe('headerOnlyResizePlugin', () => {
  const guard = headerOnlyResizePlugin()
  const withHandle = (handle: number) => {
    let state = EditorState.create({ schema, doc, plugins: [guard, columnResizing()] })
    state = state.apply(state.tr.setMeta(columnResizingPluginKey, { setHandle: handle }))
    const view = {
      get state() {
        return state
      },
      dispatch(tr: Transaction) {
        state = state.apply(tr)
      },
    }
    return { view: view as unknown as EditorView, handle: () => columnResizingPluginKey.getState(state)?.activeHandle }
  }
  const mousedown = (view: EditorView) =>
    guard.props.handleDOMEvents?.mousedown?.call(guard, view, new Event('mousedown') as MouseEvent)

  it('clears a resize handle on a body cell before a mousedown can start resizing', () => {
    const { view, handle } = withHandle(cellPos(doc, 'v1'))
    expect(mousedown(view)).toBe(false)
    expect(handle()).toBe(-1)
  })

  it('keeps a header-row handle so header resizing still starts', () => {
    const header = cellPos(doc, 'Name')
    const { view, handle } = withHandle(header)
    mousedown(view)
    expect(handle()).toBe(header)
  })
})
