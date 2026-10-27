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

- Compact markdown text with directives, marks inside replaced text (replaced text is plain, so old marks in it are dropped), move steps, props edits for non-text blocks, closed-page edits on the store copy, `engine.undo`, and a persisted request-id log. Idempotency and revision memory are lost when the handle is dropped.
- A revision is a hash of the page JSON. A collision would need a different page with the same 32-bit hash; the stale check on touched blocks uses the same kind of hash. This is acceptable for catching accidental conflicts, not for security.
- Searching across pages is not part of this slice.
