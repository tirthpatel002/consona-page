# Page engine (first slice)

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
