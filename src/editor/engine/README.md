# Page engine

A headless handle on one open page: `createPageEngine({ editor })`. It reads bounded views and applies
batches of small steps through the same editor, schema, history and lock as a user edit. It has no React and
no DOM code of its own; the editor it is given does.

## Methods

- `outline({ maxChars })`: revision plus every block with `id`, `type`, `depth` and the first characters of its text.
- `read(ids, { maxChars })`: the text of named blocks, cut at `maxChars` with a `truncated` flag. Unknown ids are skipped.
- `find(query, { limit })`: case-insensitive matches in text blocks, with the block id and a short excerpt.
- `edit({ baseRevision, requestId, steps })`: steps are `replaceText`, `insertParagraphAfter`, `delete`, all by block id.
- `revision()`: the current revision.

## Rules

- **Atomic.** A batch is checked as a whole and applied as one transaction: one undo step, or nothing. Errors say which step and why (`unknown_block`, `not_text_target`, `not_allowed`, `invalid_step`, `too_large`, `locked`, `stale`, `unknown_revision`).
- **Ids.** Blocks the batch does not touch keep their ids and content. Steps address blocks by id, never by position, so an earlier step cannot shift a later one. A step that targets a block removed by an earlier step in the same batch fails the batch.
- **Id scope.** Every node with a `blockId` is addressable at any depth: paragraphs, headings, lists, list items, tables, rows and cells. `replaceText` on a container (a list item or table cell) replaces the text of its single text block; if it holds several text blocks or none it is refused with `not_text_target`. A table or list itself is not a text target. Copies made by copy and paste get new ids, as in the editor.
- **Revisions and stale checks.** A revision is a fingerprint of the whole page. The engine remembers per-block fingerprints for the last 20 revisions it handed out. An edit is refused as `stale` only when a block it touches changed since `baseRevision`, and the error lists those ids. Edits to other blocks do not block it. A revision it never handed out, or has forgotten, is `unknown_revision`: read the outline again.
- **Retry.** The same `requestId` returns the first result (`replayed: true`) and applies nothing again. Results are kept for the life of the handle only.
- **Locks and validation.** A locked page refuses every edit. Text goes in as plain text through the schema; there is no raw JSON or HTML write. Text is limited to 20 000 characters per step.
- **Source.** The transaction carries meta `source: 'program'`. Version history does not read it yet.

## Not done

- Marks inside `replaceText` (use `replaceMarkdown`), directive text that can be WRITTEN (directives are read-only), props edits for non-text blocks, props edits for non-text blocks, closed-page edits on the store copy, `engine.undo`, and a persisted request-id log. Idempotency and revision memory are lost when the handle is dropped.
- A revision is a hash of the page JSON. A collision would need a different page with the same 32-bit hash; the stale check on touched blocks uses the same kind of hash. This is acceptable for catching accidental conflicts, not for security.
- Searching across pages is not part of this slice.

## Moving blocks

`{ op: 'moveAfter', id, after }` moves a block, with its content and ids, to directly after another block. Both
blocks count as touched for the stale check. It is refused (`cycle`) when `after` is the block or inside it,
and (`not_allowed`) when the new place cannot hold that block type or leaving the old place would make its
parent invalid; the block is never wrapped or converted to fit. It is one transaction and one undo step with
the rest of the batch.

## Compact text

Pass a `markdown` converter in the options (`{ parseInline, parseBlocks, inlineToMarkdown }`; the demo wires the export plugin's). The engine does not import plugins.

- `readCompact({ ids?, maxChars?, maxLines? })` returns `{ text, lines, truncated, revision }`, one line per block in page order, two spaces of indent per nesting level: `[b3] ## Title`, `[b4] alpha **one**`, `  [b7] - item`. A list item, heading or task item gets its Markdown prefix. Any other block is a directive line, `[b9] ::type{attr=json} text`, listing only attributes that differ from the block type's defaults. The directive set comes from the schema, so a new block type needs no code. A newline inside a block's text is written `\n`, a backslash `\\`. Attribute values are cut at 120 characters. Directives are read only: there is no step that writes one.
- `replaceMarkdown { id, text }` replaces a text block's content from inline Markdown and keeps bold, italic, strike, underline, code and links. Code blocks take the text as is. Links must pass the same URL allowlist as the editor, otherwise `blocked_url` and nothing changes. HTML in the text stays literal text.
- `insertMarkdownAfter { id, text }` adds the blocks of a Markdown text after a block: paragraphs, headings, bullet, numbered and task lists, quotes, code, rules and tables. Anything else the parser produces (such as an image) is refused with `not_allowed`; ids in parsed text are dropped and fresh ones are assigned. At most 200 blocks per step (`too_large`).
- Both need the converter; without one they fail with `needs_markdown` and `readCompact` returns `null`.
- Not measured: token savings against raw JSON. No claim is made.

## Props, undo and the program tag

- `setProps { id, props }` sets plain attributes (strings, numbers, booleans, null) on a block that is not a file or embed. The attribute must exist on the block type, must be the same kind as its default, and its name must not suggest a URL or file (`src`, `href`, `url`, `blob`, `link`, `html`, `script`): those fail with `blocked_url`. A heading level must be a whole number from 1 to 6. Strings are limited to 200 characters. Files and embeds are changed through the media tools, never here. Only these two rules are special-cased (heading level, name filter); other attribute values are checked for kind, not for meaning.
- `undo()` steps back the last batch this handle applied, as one program change. It is refused (`changed_since`) if the page differs from what that batch produced, so it never discards later edits, and (`nothing_to_undo`) when there is none. It is not the editor's undo stack: it writes the earlier content back as a new change. Undo is per handle and is lost when the handle is dropped.
- Every batch carries `source: 'program'`. Version history classifies these as the `program` kind (stored with each version's changes). The history window does not display change kinds yet.

## Pages: `createPagesEngine`

Works by page id over the registry and store, with the same steps. Pass `registry`, `store`, `settings`, a Markdown converter, a `createEditor` that makes a detached editor (the demo's omits the persistence plugin, so it never saves by itself) and optionally a `requestLog`.

- `attach(pageId, editor)` routes a page that is open through its editor, so history, the saved indicator and autosave behave as for a user edit. The engine does not write an open page itself.
- A closed page is edited on its stored copy through a detached editor, then written once with `expectedRevision`. A save from another tab in between gives `conflict` and nothing is written; a failed write gives `store_failed` and nothing is changed or logged as done.
- Writes are refused for a locked page (`locked`, from the page settings), a page in the trash or under a trashed page (`trashed`) and an unknown page. Reads are allowed for trashed pages.
- A stored page whose blocks lack ids is refused (`ids_missing`): open it once in the editor so ids are assigned and saved.
- The base revision for a closed page is the content revision returned by `readCompact`/`outline`. Per-block stale detection (the changed ids) only exists inside one handle; across handles a base revision that is not the current one is `unknown_revision`, so the caller re-reads.
- The request log is kept per page (last 20 successful edits) and survives reload: a retry with the same id returns the first result with `replayed: true` and writes nothing. If the log cannot be written, the edit still stands and only cross-reload retry safety is lost. Failed edits are not logged.
- `create({ parent, title, text })` checks the text before making a record, so a refused text leaves no page. `children`, `rename`, `move`, `trash`, `restore` and `search` report registry errors as codes.
- Closed-page undo is held in memory per page (the body before the last batch). It is refused if the stored revision moved on.

Needs a DOM (the detached editor is a normal editor that is never shown), not React. A DOM-free entry is part of the packaging work and is not done.

Page settings (`createSettingsStore`): `locked` and `aiReview` (`ask` or `apply`), kept per page and deleted with the page. The editor controller saves the lock there and re-applies it on load, so a locked page stays locked after a reload. If saving the lock fails, `lockSaveFailed` is true on the controller and the demo shows nothing about it yet, so closed-page code may not see the lock.
