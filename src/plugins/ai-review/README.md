# AI review adapter

`createAiReviewController({pageId, engine, settings, provider})` separates proposal generation from writes.
The demo `AiTools` uses only `createMockAiProvider()`: uppercase and a short excerpt are deterministic local
operations, not model output. No fetch, credentials or paid model calls are included.

Capture selected content before moving focus, then call `engine.readCompact(pageId)` to register its revision.
Pass that revision to `generate(action, targets, capturedRevision)`. A changed revision refuses generation.
Partial selection snapshots preserve the surrounding inline text and marks; block selections use the block
selection state, including nested scopes. Page scope addresses text blocks only, never media or container props.

`ask` is the per-page default. Only Accept calls `engine.edit`, with the reviewed Markdown steps and one
request id. Discard writes nothing. The Never ask me again box saves `aiReview: 'apply'` only after a successful
edit. A failed preference save reports that the edit applied but review is still on. Page Settings can restore
`ask`; it displays the lock and does not write it. Storage failures stay visible.

Apply mode still calls the same engine: locked/trashed pages, unsafe URLs, invalid schema and stale edits
remain refused. Failures never trigger an overwrite. Select again / re-run captures fresh content instead.
`Undo changes` calls `engine.undo(pageId)` and reports `changed_since` without discarding later typing.

An injected provider receives selected compact content and targets. The host must obtain appropriate
consent and disclose the destination before connecting a remote provider. A saved apply preference is only
review consent, not permission to transmit data, spend, bypass validation or widen the selected scope.
The controller permits only `replaceMarkdown` and `insertMarkdownAfter` on selected block IDs. The current
mock preserves partial-selection boundaries. A real provider needs its own partial-range proof/validation.

`AiTools`, `PageSettingsModal` and their bounded modal are app components. The host supplies an attached
`PagesEngine` and settings store. The plugin module exports the controller, provider interfaces and
`captureAiTargets` so other hosts can build their own UI. The controller has no React dependency.
