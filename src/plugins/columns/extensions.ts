import { mergeAttributes, Node } from '@tiptap/core'

export const MIN_COLUMNS = 2
export const MAX_COLUMNS = 5
/** A grid wraps into rows, so it can hold more cells than a single row of columns. */
export const MAX_GRID_CELLS = 12
export const MIN_GRID_TRACKS = 2
export const MAX_GRID_TRACKS = 6

/** Most cells a list with this layout may hold. */
export const maxCells = (layout: unknown): number => (layout === 'grid' ? MAX_GRID_CELLS : MAX_COLUMNS)

/** A row of side-by-side columns. `layout: 'grid'` wraps the columns into rows of equal tracks instead. */
export const ColumnList = Node.create({
  name: 'columnList',
  group: 'block',
  content: `column{${MIN_COLUMNS},${MAX_GRID_CELLS}}`,
  isolating: true,
  defining: true,
  addAttributes() {
    return {
      layout: {
        default: 'columns',
        parseHTML: (element) => (element.getAttribute('data-layout') === 'grid' ? 'grid' : 'columns'),
        renderHTML: (attrs) => ({ 'data-layout': attrs.layout === 'grid' ? 'grid' : 'columns' }),
      },
      /** Cells per row of a grid (null = as many as fit). */
      tracks: {
        default: null,
        parseHTML: (element) => {
          const value = Number(element.getAttribute('data-tracks'))
          return value >= MIN_GRID_TRACKS && value <= MAX_GRID_TRACKS ? value : null
        },
        renderHTML: (attrs) => (attrs.tracks && attrs.layout === 'grid' ? { 'data-tracks': String(attrs.tracks) } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="column-list"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column-list', class: 'page-columns' }), 0]
  },
})

/** One column; its `width` is a relative weight (flex-grow), so columns stay balanced when one is added or removed. */
export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  addAttributes() {
    return {
      width: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute('data-width')) || 1,
        renderHTML: (attrs) => ({ 'data-width': String(attrs.width), style: `flex-grow: ${attrs.width}` }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column', class: 'page-column' }), 0]
  },
})
