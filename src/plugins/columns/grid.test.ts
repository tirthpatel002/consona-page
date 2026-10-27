// @vitest-environment jsdom
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../editor/core'
import { columnsPlugin } from '.'
import { isHorizontalGap, tracksForCellWidth } from './behavior'
import { addColumn, dropBeside, setColumnsLayout, setGridTracks } from './operations'

const cells = (n: number) => Array.from({ length: n }, (_, i) => `<div data-type="column"><p>c${i}</p></div>`).join('')
const grid = (n: number, extra = '') => `<div data-type="column-list" data-layout="grid"${extra}>${cells(n)}</div>`
const make = (content: string) =>
  createTestEditor({ plugins: [{ id: 'text', extensions: [StarterKit] }, columnsPlugin], content })

describe('column divider hit', () => {
  it('covers the whole gap between two columns, not a thin line in the middle', () => {
    expect(isHorizontalGap(112, 100, 124)).toBe(true)
    expect(isHorizontalGap(100, 100, 124)).toBe(true)
    expect(isHorizontalGap(124, 100, 124)).toBe(true)
    expect(isHorizontalGap(90, 100, 124)).toBe(false)
    expect(isHorizontalGap(112, 200, 100)).toBe(false)
  })
})

describe('grid', () => {
  it('sets tracks per row as one undoable step and renders the attribute', () => {
    const { editor, destroy } = make(grid(6))
    const before = editor.getJSON().content?.[0]
    expect(setGridTracks.run(editor, 0, 3)).toBe(true)
    expect(editor.getHTML()).toContain('data-tracks="3"')
    expect(setGridTracks.run(editor, 0, 3)).toBe(false)
    editor.commands.undo()
    expect(editor.getJSON().content?.[0]).toEqual(before)
    expect(setGridTracks.run(editor, 0, 99)).toBe(true)
    expect(editor.getHTML()).toContain('data-tracks="6"')
    destroy()
  })

  it('holds more cells than a column row and refuses to become columns when it has too many', () => {
    const { editor, destroy } = make(grid(8))
    expect(editor.state.doc.firstChild?.childCount).toBe(8)
    expect(setColumnsLayout.run(editor, 0, 'columns')).toBe(false)
    for (let i = 0; i < 10; i++) addColumn.run(editor, 0)
    expect(editor.state.doc.firstChild?.childCount).toBe(12)
    expect(() => editor.state.doc.check()).not.toThrow()
    destroy()
  })

  it('columns still stop at five, and leaving the grid drops its tracks', () => {
    const { editor, destroy } = make(`<div data-type="column-list" data-layout="columns">${cells(5)}</div>`)
    expect(addColumn.run(editor, 0)).toBe(false)
    destroy()
    const g = make(grid(4, ' data-tracks="2"'))
    expect(g.editor.getHTML()).toContain('data-tracks="2"')
    setColumnsLayout.run(g.editor, 0, 'columns')
    expect(g.editor.getHTML()).not.toContain('data-tracks')
    g.destroy()
  })

  it('maps a dragged cell width to a per-row count within limits', () => {
    expect(tracksForCellWidth(900, 300)).toBe(3)
    expect(tracksForCellWidth(900, 100)).toBe(6)
    expect(tracksForCellWidth(900, 800)).toBe(2)
    expect(tracksForCellWidth(900, 0)).toBe(6)
  })
})

describe('grid cell reorder', () => {
  it('moves a single-block cell before another cell in one undo step, keeping the grid layout', () => {
    const { editor, destroy } = make(grid(3))
    const texts = () => {
      const out: string[] = []
      editor.state.doc.firstChild?.forEach((c) => out.push(c.textContent))
      return out
    }
    const before = editor.getJSON().content?.[0]
    const positions: number[] = []
    editor.state.doc.firstChild?.forEach((_c, o) => positions.push(1 + o))
    const [p0, , p2] = positions as [number, number, number]
    const cellSize = editor.state.doc.nodeAt(p2)?.nodeSize ?? 0
    expect(dropBeside.run(editor, p2 + 1, p2 + cellSize - 1, p0 + 1, 'left')).toBe(true)
    expect(texts()).toEqual(['c2', 'c0', 'c1'])
    expect(editor.state.doc.firstChild?.attrs.layout).toBe('grid')
    editor.commands.undo()
    expect(editor.getJSON().content?.[0]).toEqual(before)
    destroy()
  })
})
