# Consona Page - a pluggable block editor

Vite + React 19 + TypeScript + Tiptap 3. One Tiptap (ProseMirror) editor is the whole page: text is editable
everywhere and selections span text and blocks. Rich blocks are plain React components embedded as atom nodes
("embed blocks"); the table is an editor-native node. Every feature — text formatting, block actions, the props
editor, the JSON inspector and each block — is a plugin. The demo starts with sample data and persists edits on the current device. No external UI
library: styling is plain CSS on a small set of editor tokens.

## Run

```sh
npm ci
npm run dev          # http://127.0.0.1:5173
npm run build        # tsc (strict) + vite build → dist/
npm run check        # typecheck + lint + format:check + unit tests
npm test             # vitest (logic and jsdom integration tests)
npm run lint         # eslint (incl. import cycles + architecture boundaries)
npm run format       # prettier --write
```

## Library development

This repository builds both a demo and an installable ESM library. It is still private and has not been
published. The package name remains `page` as a development identifier, not a claim that this registry name
is available. A license, final package identity and release approval are required before publication.

```sh
npm run build:library  # dist/library: JS entries, declarations, stylesheet
npm run test:package   # pack, install in an isolated consumer, exercise runtime/types/browser build
npm pack              # local tarball only; runs the library build first
```

- [Public API and browser integration](docs/API.md)
- [Engine usage and boundaries](docs/ENGINE.md)
- [Compatibility, migrations and release gates](docs/RELEASING.md)

Use `page/react` only in a browser/client component; `page/engine`, `page/store`, `page/compact` and
`page/markdown` can be imported without browser globals. Importing an engine is DOM-free, but creating a
Tiptap editor and editing a closed page through a detached editor still requires a DOM. The store alone
can run in Node with memory or a host adapter. No CommonJS, server-rendered editor, or React Server
Components support is claimed. Import `page/styles.css` once in the host.

## Architecture

```
src/
  editor/core/            # generic editor engine — knows nothing about specific blocks
    index.ts              # PUBLIC API (plugins/blocks/app import only from here; lint-enforced)
    json.ts               # JsonValue/JsonObject + toJsonObject
    plugin/               # PagePlugin + PanelDefinition types, blockPlugin() helper
    block/                # BlockDefinition → defineBlock() → BlockModule; the `embedBlock` node,
                          #   its node view (label, outline), error boundary, problem placeholder
    gutter/               # global block gutter for every top-level block: "+" and drag/menu handle
    menu/                 # menuNavigation (pure ↑/↓/Home/End over enabled items), shared by menus
    registry/             # composePlugins() (pure, conflict-checked) + createExtensions()
    slash/                # "/" menu: @tiptap/suggestion extension, external store, ranking, React menu
    toolbar/              # ToolbarItem type + Toolbar (formatting buttons, Insert block, panel toggles)
    PageEditor.tsx        # shell: toolbar + EditorContent + block gutter + panels + overlays + slash menu
    styles/tokens.css     # editor design tokens (--page-* CSS variables)
    styles/editor.css     # theme-agnostic chrome + document typography
  plugins/                # feature plugins
    text/                 # StarterKit (markdown input rules), placeholder, H1/H2/B/I/list, text slash items,
                          #   "Turn into" block actions (turnInto.ts)
    block-actions/        # Duplicate / Move up / Move down / Delete (moveBlock.ts is pure)
    props-editor/         # "Props" panel + "Edit props…" action (JSON editing of any embed block)
    json-view/            # live editor.getJSON() panel
  blocks/                 # block plugins, one folder each
    callout/              # example embed block (plain React + CSS) — see "Add a block"
    table/                # editor-native table (Tiptap table nodes, not an embedBlock) — see below
  app/                    # composition root: plugins.ts (the plugin list), App.tsx, app.css (base styles)
  content/initial-doc.json
```

**Data model.** Every block is one atom node `{ type: 'embedBlock', attrs: { blockType, props } }`
(`group: block`, draggable, selectable as a unit). `props` is plain JSON. On render the node view looks up
`blockType` in the registry, validates `props` with the block's schema (unknown keys are stripped, defaults
applied), and renders. Unknown types, invalid props (with readable issue paths) and render exceptions each show
an inline placeholder for that block only (`BlockProblem` / per-block `BlockErrorBoundary`).

**Types at the boundaries.** A block is authored as a typed `BlockDefinition<P>`; `defineBlock` erases `P`
into a `BlockModule` whose surface is `unknown` in → validated → `JsonObject` out, so no `any` crosses into the
registry. Schemas are typed as Zod 4 core `$ZodType<P>`, so classic `zod` or `zod/mini` both work (blocks use
`zod/mini`: ~26 kB min vs ~89 kB).

**Composition.** `composePlugins(plugins)` merges extensions, blocks, slash items, toolbar items, block actions
and panels in plugin order, auto-generates an "insert" slash item per block, and throws `PluginConflictError` on
any duplicate id (plugin, extension name, block type, slash/toolbar/action/panel id). `createExtensions` adds the
core block node and slash extension. The registry is built once at startup.

**Events.** The node view's `stopEvent` hands every event inside the component body to the
component, so clicking, typing or hovering inside an embedded component never moves the editor
selection; the frame goes to ProseMirror (select). `ignoreMutation` keeps ProseMirror from
re-parsing component DOM.

**Block gutter (all blocks).** `core/gutter/BlockGutter.tsx` is one gutter for every top-level block —
paragraphs, headings, lists, quotes, code, the native table and embed blocks. It follows the hovered block
(`blockGeometry.ts`: nearest top-level block, `pickBlock.ts` pure) and is centred on the block's first line
(first text position via `coordsAtPos`; the top 24px for atoms), so it does not jump inside a block.

- **Handle** (⠿): drag moves the block (`dragBlock.ts`: node-selects it and hands ProseMirror the slice as
  `view.dragging`, so the drop is one undoable move); click node-selects the block and opens the block menu
  (`BlockHandleMenu.tsx`: focus moves into it, ↑/↓/Home/End, Enter/Space, Esc returns focus to the editor, Tab
  and outside click close).
- **Menu** (`composeBlockMenu.ts`, pure): an embed's own props actions first (labelled with the block title), then
  registry `blockActions` that apply to the block (`appliesTo(target)`, where `target` is a `BlockTarget`
  `{ pos, node, nodeType, blockType, isEmbed, props }`), grouped by their optional `section` label, danger items
  last — e.g. _Turn into_ (text plugin, paragraphs/headings), Duplicate / Move up / Move down / Delete
  (block-actions plugin), _Edit props…_ (props-editor, embeds).
- **+**: the `openSlashMenuBelow(pos)` command inserts an empty paragraph below the block, puts the caret there and
  opens the "/" menu; choosing an item turns/inserts that block there, Esc or dismissing leaves the empty
  paragraph (the typed "/" is removed without an undo entry).

**Editable blocks (render context).** `render(props, context)` also receives
`context = { editable, update(next: P): boolean, selectBlock() }`. `update` re-validates `next` against the
block's schema and writes it to the node's `props` attr in one ProseMirror transaction (so it is undoable with
⌘Z); invalid props are rejected (`false` + a console warning) and the document is left untouched.
`selectBlock()` node-selects the block and focuses the editor, so keyboard focus returns to the editor.

**Native table** (`src/blocks/table/`, slash item _Table_; row and column reordering is described in [`src/blocks/table/REORDER.md`](src/blocks/table/REORDER.md)). Unlike an embed block (an atom whose content is
component props), the native table is built on `@tiptap/extension-table`
(`table`, `tableRow`, `tableHeader`, `tableCell` — in Tiptap 3 one package) so every cell is ProseMirror content:
text selections run within and across cells and into surrounding paragraphs, marks/undo/copy-paste work, and
dragging across cells makes a `CellSelection` (highlighted).

- `NativeTableView.ts` — DOM node view (replaces Tiptap's `TableView`, reuses its `updateColumns`): a toolbar slot
  and the `<table>` whose `tbody` is the content DOM. The table has no handle of its own: it is moved and
  selected from the global block gutter like every other block. Column resizing is prosemirror-tables'
  `columnResizing`.
- `extensions.ts` — configured `Table` (resizable, `allowTableNodeSelection` so the handle selects the node),
  `sortTableByColumn(direction)` command, and a guard that turns a mousedown inside a node-selected table into a
  caret so selecting text in a cell can never start a table drag.
- `TableToolbar.tsx` + `tableActions.ts` + `ToolbarMenu.tsx` — contextual toolbar (React portal into the table's
  slot, shown while the selection is in/on a table): **Add ▾** (row above/below, column left/right), **Remove ▾**
  (row, column | delete table), **Sort ▾** (ascending A→Z / descending Z→A by the current column — shown only
  when the selection is in a header cell, `isInHeaderRow`), a **Header**
  toggle, and one contextual cell button — _Merge_ for a mergeable multi-cell selection, _Split_ inside a merged
  cell, hidden otherwise. Menus never take editor focus (mousedown is prevented); while open they handle
  ↑/↓/Home/End, Enter/Space, Esc/Tab in the capture phase (core `menuNavigation`), close on outside click or
  after choosing, and grey out items whose command `editor.can()` rejects. Each item is one undoable command.
  Every toolbar item is a 24px flex box centred on one axis; menu buttons use an outlined chevron
  (`ChevronDownIcon.tsx` / `icons.ts`).
- `headerSort.ts` — sorting starts from header cells: each header cell gets a small outlined chevron button (a
  ProseMirror widget decoration, visible on hover/focus and for the active column). Clicking it puts the caret
  in that cell and asks the toolbar (transaction meta) to open the Sort menu at the chevron.
- `sortRows.ts` (pure: numeric-aware, stable, empties last) and `sortTable.ts` (ProseMirror command: header rows
  stay on top, one replace step; refuses tables with row spans) are unit-tested.
- `table.css` — plain CSS on the editor tokens (`--page-bg`, `--page-fg`, `--page-border`, `--page-muted`,
  `--page-muted-fg`, `--page-info`, `--page-radius`, `--page-density-factor`): rounded bordered shell with a soft
  shadow, compact cells with padding on the `td`/`th` itself, muted small header text, soft grid lines, row hover,
  a continuous selected-cell fill (selected cells paint their own borders in the fill colour), resize handle.

**Props editor (fallback).** `src/plugins/props-editor` adds a "Props" panel and an _Edit props…_ block action.
It edits the selected block's props as JSON, validates with the block schema (issues listed with paths) and
applies via the `updateBlockProps(pos, props)` command — works for every block, including fields that have no
inline UI.

**Boundaries (ESLint).** `import-x/no-cycle`; `editor/core` may not import `plugins`, `blocks`, `app` or
`content`; plugins/blocks/app may only import the core via `editor/core` (its `index.ts`).

**Styles.** Plain CSS, no CSS framework. `editor/core/styles/tokens.css` defines the `--page-*` tokens (font,
radius, density, background/foreground, border, muted, overlay and info/success/warning/danger colours with
`-subtle` / `-subtle-fg` tints); override them on `:root` to re-theme. The core chrome uses `currentColor` /
`Canvas`; the native table and blocks use the tokens. `app/app.css` sets the page base (font, colours, box
sizing). Each plugin imports its own stylesheet.

## Add a block (embed plugin)

Any React component can be a block. The example is `src/blocks/callout` (a styled note with a `variant`, optional
`title` and `body`):

```
src/blocks/callout/
  model.ts       # props schema (zod/mini), template, props actions — pure, unit-tested (model.test.ts)
  Callout.tsx    # the React component — knows nothing about the editor
  callout.css    # its styles, on the editor tokens (var(--page-…))
  index.tsx      # defineBlock(...) binding + calloutPlugin
```

1. **Model** — `src/blocks/<name>/model.ts`: the props schema (any Zod 4 schema; `zod/mini` keeps the bundle
   small), a template for new blocks, and optional props actions shown in the block's handle menu:
   ```ts
   import * as z from 'zod/mini'
   import type { BlockPropsAction } from '../../editor/core'

   export const CALLOUT_VARIANTS = ['info', 'success', 'warning', 'danger', 'neutral'] as const
   export const calloutSchema = z.object({
     variant: z._default(z.enum(CALLOUT_VARIANTS), 'info'),
     title: z.optional(z.string()),
     body: z.string().check(z.minLength(1, 'Callout body is required')),
   })
   export type CalloutProps = z.infer<typeof calloutSchema>
   export const calloutTemplate = (): CalloutProps => ({ variant: 'info', title: 'Note', body: 'Add a note…' })
   export const calloutActions: readonly BlockPropsAction<CalloutProps>[] = CALLOUT_VARIANTS.map((variant) => ({
     id: `callout:variant-${variant}`,
     label: (props) => `${props.variant === variant ? '✓ ' : ''}Style: ${variant}`,
     apply: (props) => ({ ...props, variant }),
   }))
   ```
   Persisted props are validated with this schema on every render: unknown keys are stripped, defaults applied,
   and invalid props show an inline problem placeholder (with issue paths) instead of the component.
2. **Component** — `Callout.tsx`: an ordinary React component with its own CSS (`callout.css`, using
   `var(--page-…)` tokens). It needs no editor imports.
3. **Binding** — `index.tsx`:
   ```tsx
   import { blockPlugin, defineBlock } from '../../editor/core'
   import { Callout } from './Callout'
   import { calloutActions, calloutSchema, calloutTemplate, type CalloutProps } from './model'
   import './callout.css'

   export const calloutBlock = defineBlock<CalloutProps>({
     type: 'callout', // stable id stored in documents
     title: 'Callout',
     description: 'Highlighted note',
     keywords: ['note', 'alert', 'info', 'warning', 'tip'],
     schema: calloutSchema,
     template: calloutTemplate,
     actions: calloutActions,
     render: ({ variant, title, body }) => (
       <Callout variant={variant} title={title}>
         {body}
       </Callout>
     ),
   })
   export const calloutPlugin = blockPlugin(calloutBlock)
   ```
   Interactive components can write back through the render context: `render(props, { editable, update,
selectBlock })` (see "Editable blocks" above).
4. **Register** — export the plugin from `src/blocks/index.ts` and add it to `pagePlugins` in
   `src/app/plugins.ts`. The block now appears in the "/" menu, the gutter "+", and the toolbar's Insert menu;
   it gets the generic handle-menu actions (Duplicate, Move, Delete, Edit props…), the props panel, the error
   boundary and runtime props validation.
5. **Test** — add a `model.test.ts` next to the model (template valid, actions keep props valid, invalid input
   rejected). If you add the block to `src/content/initial-doc.json`, add its schema to
   `src/content/initial-doc.test.ts`.

## Add a feature plugin

Return a `PagePlugin` with any of `extensions` (Tiptap), `slashItems`, `toolbarItems`, `blockActions`
(`{ id, label, section?, danger?, appliesTo?(target), run({ editor, pos, node, nodeType, blockType, isEmbed,
props, openPanel }) }` — shown in every applicable block's handle menu), `panels`
(`{ id, label, render(editor) }`) and `overlays` (`{ id, render(editor) }` — floating UI such as contextual
toolbars, rendered once by `PageEditor`; it subscribes to the editor itself), then add it to
`src/app/plugins.ts`. See `src/plugins/*` and `src/blocks/table` for examples.

## Saving, identity and recovery

The demo loads a page before mounting its editor. It saves through a revision-checked store with a visible
saving/saved/error/conflict status and retry. A conflict never overwrites the newer stored body. Download
unsaved edits before explicitly discarding them. Lifecycle flushing is best effort, not crash recovery.

- Page bodies live once, by stable page id, in IndexedDB (localStorage fallback when appropriate). The registry
  holds only hierarchy, title, order and trash state. Trash keeps bodies until explicit permanent deletion.
- Schema migration upgrades older records and refuses unsupported future formats. A legacy localStorage
  copy is retained on import. Recovery from a missing IndexedDB record is an explicit choice, not silent
  replacement with an old copy.
- Stable block ids survive ordinary edits and moves; pasted/duplicated blocks receive new ids. Old pages
  acquire ids when opened. Closed-page engine edits refuse bodies missing ids rather than silently migrate.
- New media uploads use the blob adapter when provided; the body holds a reference. File limits are checked
  before writing. An inline-data fallback remains for hosts without a blob adapter.
- History/comments use a sidecar adapter (localStorage by default, IndexedDB in the demo when available).
  Sidecar write failure is shown separately from page saving.
- IndexedDB page changes use BroadcastChannel for other tabs. Dirty editors preserve local edits and report
  conflicts. Registry, settings and sidecar records are not a collaborative multi-user data model.
- The page engine provides bounded reads, rich Markdown edits, revisions, replay, guarded undo, and page-level
  operations. Locks persist in page settings when supplied. See the engine guide for retry durability limits.

Browser coverage, storage-failure checks and remaining release gates are recorded in
[the release guide](docs/RELEASING.md). Unit coverage is not a security or production certification.

## Bundle size

The demo build and library build are different outputs. Library dependencies remain external, with React and
React DOM as peers; a host bundles only what it imports. Optional plugins and blocks have separate entries.
The stylesheet currently includes all built-in styles, including math styles; it is not split per plugin.
The packed-consumer test prints the actual tarball size and its browser bundle size on each run. Do not
compare one JS entry's size with a complete application or claim a fixed performance budget from it.

For demo analysis use `ANALYZE=$PWD/.verify/mods.json npm run build`, or `SOURCEMAP=1 npm run build` then
`npx source-map-explorer dist/assets/*.js`.

## Design

Read [DESIGN.md](DESIGN.md) before building any block, plugin or UI surface.

## Media blocks

One native block holds an image, video, audio file, file or embedded video. Each has an optional caption (hiding it keeps its text), a width (or full width), and, for images, alt text, a link and a crop (shape, zoom and focus point; the stored picture is never changed). Old media blocks load unchanged: caption shown, no alt text.

Insert from the slash menu (Image, Video, Audio, File, and their "from link" variants), by paste or by drop. The insert panel has an Upload tab (choose or drop a file, progress, Cancel, plain error messages) and an Embed link tab. Replace uses the same panel. YouTube and Vimeo links become sandboxed embeds; any other page address is refused.

Bar (shown when the block is selected or the caret is in its caption; one bar per kind): Align menu (left, center, right; hidden at full width), Caption, Download, Open original, Comment, and More (Replace, Link, Alt text, Crop, Full screen for images; Full width, Reset size; Delete). Pressing the picture selects the block; Space opens an image full screen; Escape closes it. Resize: handles on both edges (mouse, touch, pen), snap to full width near the edge, 80 px minimum; arrow keys on a focused handle change the width by 16 px (Shift 64), Home resets, End fills. An embedded player takes presses only once its block is selected. Everything that edits is disabled on a locked page; the bar is not shown there.

Source rules, per kind (`sources.ts`, applied on parse, render, import and insert): images allow data:image png, jpeg, gif, webp, avif; video data:video mp4, webm, ogg; audio a short list of audio types; files a short list of document and archive types (never HTML, SVG or XML). Remote sources must be http(s) or relative. Embeds are only `youtube-nocookie.com/embed/<id>` and `player.vimeo.com/video/<id>`. Links on images are http(s) or mailto. Files are only ever downloaded, never opened as a page.

Exports: HTML keeps every attribute above and round-trips; Markdown writes images (alt or caption), audio, a file link and an embed link; Word embeds PNG/JPEG/GIF images and writes a text placeholder for the rest.

Known limits: media uploads without a host blob store remain inline. Media/export host configuration is
module-scoped, so one independently configured host per application is supported, not concurrent independent
workspaces in one JavaScript realm. The bar uses a mix of icons and text. Native clipboard, touch, assistive
technology and cross-browser release checks remain separate from desktop Chrome and simulated-event tests.
