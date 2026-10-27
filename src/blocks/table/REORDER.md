# Table row and column reorder

Files: `reorder.ts` (pure move logic), `reorderHandles.ts` (handle widgets), `reorderDrag.ts` (pointer drag,
ghost, drop line, auto-scroll), `tableMoveCommands.ts` (one-step commands), `table.css` (handle and drag styles).

## Behaviour

- **Column handle**: a thin bar centred on the top edge of each first-row cell (the header cell when there is
  a header row). Drag it sideways to move the whole column, header cell included.
- **Row handle**: a thin bar centred on the left edge of each body row's first cell. Drag it up or down.
  Header rows never move and nothing can be dropped above them. Without a header row every row can move.
- While dragging: a ghost of the picked-up column or row follows the pointer, a line shows where it will land,
  the table scrolls sideways (and the page up or down for rows) when the pointer is within 48px of an edge.
  Escape or a cancelled pointer aborts with no change. A press without movement (under 4px) selects the
  column or row as cells.
- **Keyboard**: focus a handle (click it) and use Left/Right (column) or Up/Down (row). The toolbar's
  **Move ▾** menu has Column left/right and Row up/down for the column or row of the caret. Both keep focus.
- **Touch and pen**: pointer events with `touch-action: none` on the handle; on devices without hover the
  handles are always visible and larger.
- Locked (read-only) pages: handles are hidden and ignore presses.

## Data guarantees

- A move is one `replaceWith` of the table: one undo step. Existing cell and row nodes are reused, so text,
  marks, column widths, cell types (header or normal) and block ids travel with the content and nothing is
  rewritten. The table node and its id are unchanged.
- Merged cells (any `colspan` or `rowspan` above 1) disable both kinds of move for that table: a plain cell
  move would tear a merged cell apart. The handles are not drawn, and `columnReorderBlocker` /
  `rowReorderBlocker` return the reason. Split the cells first.
- Tables with fewer than two columns, or fewer than two body rows, show no handle of that kind.
- The existing Sort command is unchanged.

## Known limits

- Tested in desktop Chrome (mouse and emulated touch). Not tested: screen readers, real touch hardware,
  Safari, Firefox.
- The handle's thin bar is small by design; the hit area is larger than the bar but not measured against any
  accessibility target-size rule.
- Handles are one per column or row, so a very wide table draws many; they only show on hover, focus or touch.
- Dragging past the edge of a page that is itself scrolled inside a nested scroller uses the nearest
  vertically scrolling ancestor, otherwise the window.
- The Move menu and arrow keys move one step at a time; there is no "move to position".
- The selection fill for selected table cells now uses a neutral tint (`--page-fg` mix) instead of the accent.
