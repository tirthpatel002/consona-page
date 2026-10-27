# Page store

A storage adapter that keeps pages by stable id, one body per id. It is exported from the editor core.

- `PageStore`: `get`, `put`, `remove`, `list`. Writes reject on failure so callers can show it.
- `put(id, doc, { expectedRevision })` is atomic with its check. A number means "only if the stored revision is this", `null` means "only if the page does not exist", and omitting it writes unconditionally. A mismatch throws `StaleRevisionError` and writes nothing.
- `createMemoryStore()` for tests and hosts that persist elsewhere.
- `createIndexedDbStore({ name, migrateLegacyLocalStorage })` for the browser. With migration on, the first `get` of an id with nothing stored imports the old `page:doc:<id>` localStorage copy and leaves it in place.

Status: the demo saves through this store (IndexedDB, with a localStorage adapter as fallback). Adapters are tested against memory, an in-memory IndexedDB fake, and, for the demo flow, a real desktop Chrome run (legacy import, edit and reload, two-tab conflict, forced write failure and retry). Not done: the page registry, hierarchy, trash and move, cross-tab change events, large-media quota handling, and other browsers.

## Format version and storage limits

Every stored page carries `format` (current: `FORMAT_VERSION`, 1). A record without one counts as format 0 and is upgraded when read, in memory and on its next save; the content is not rewritten otherwise. Upgrade steps live in `format.ts` as one function per version. A page with a newer format than this code knows is refused with `UnsupportedFormatError` on read and on write, and the stored record is left exactly as it was. The demo then stops saving and offers "Download my version".

A write the browser refuses for lack of room rejects with `StorageQuotaError` (the browser reports it under different names; `isQuotaError` covers the known ones). The localStorage adapter puts the old body, revision and format back if a write fails half way. The saved copy stays as it was, the status line says there is no room, and Try again saves once there is room.

Checked only with simulated failures (a stubbed quota error in jsdom and fake-indexeddb). No real quota-exceeded run in a browser has been done. Only format 0 and 1 exist, so the upgrade chain has one step.

## Changes from other tabs

`PageStore.subscribe(listener)` (optional) reports each successful write or removal as `{ id, revision }` (`revision` is null for a removal). The IndexedDB adapter also tells other tabs on the same origin through BroadcastChannel (`page-store:<database name>`); BroadcastChannel never delivers to the sender. localStorage and memory adapters notify listeners in the same tab only, so another tab is not told and finds out at its next save.

The demo editor uses it like this: with nothing unsaved in this tab, another tab's newer copy is shown ("Updated from another tab") and saving continues on top of it. With unsaved edits here, nothing is replaced and the conflict (download, explicit discard) appears at once instead of at the next failed save. A page removed in another tab is also a conflict, never a silent empty page. This tab's own saves, and saves from other editors sharing its session, are ignored. Undo after a live update can step back into content from before it; that is a normal edit and saves on top.

Checked in real desktop Chrome with two tabs (idle tab updated, edit on top without conflict, other tab then updated, unsaved-edit conflict). The conflict case there used a direct write plus a hand-posted broadcast message rather than a second editor typing within the 500 ms save window. A tab in the background may receive the message late. Not checked: other browsers, Safari without BroadcastChannel, three or more tabs.

## Page tree (registry)

`createPageRegistry({ storage, pages })` keeps the tree: each `PageRecord` has `id`, `parentId`, `title`, `icon`, sibling `order`, `trashedAt` and `createdAt`. The body stays in the page store under the same id; a title change, move or trash never copies or rewrites a body. Parents and any future preview or link hold the id only.

From the core index the type is exported as `PageListRegistry` (the plugin composition type already uses `PageRegistry`). The demo (`app/demoSession.ts`) provides `demoBlobs` and `demoRegistry` on IndexedDB, or in memory when IndexedDB is missing; nothing in the UI uses them yet.

- `create`, `rename`, `move(id, parentId, index)`, `moveToTrash`, `restore` each are one atomic storage write and return `undo`, which writes the previous records back once. A page cannot move into itself or its own subpages (`cycle`), nor under a trashed page.
- Trash hides the page and its whole subtree from `children`; only the page trashed directly shows in `trash()`. `restore` returns it under its old parent, or to the top level if that parent is gone or trashed, and puts it last among its siblings.
- `deleteForever` needs the page in the trash, deletes every body in the subtree first and the records after, so a failed body delete leaves the page in the trash to retry. It cannot be undone.
- IndexedDB schema is now version 2: an object store `registry` beside `pages`. A version 1 database upgrades in place and keeps its bodies (unit test, plus a real Chrome open of a hand-built version 1 database: it opened at version 2 with both stores). A second tab still running the older code keeps the old version open and can block the upgrade; the open then fails with the "blocked by another tab" error instead of opening.

Not done: the demo does not use the registry yet (no sidebar, no nested-page block, no previews); changes to the registry are not announced to other tabs; undo is per call, not a history stack; titles are plain text, no uniqueness; ids of deleted pages are not tombstoned, so a stale link to a deleted page must be handled by the reader.

## Files (blob store)

`BlobStore` keeps binary files beside the page bodies so a page holds only a file id, not a data URL: `put(pageId, blob, { id? })`, `get`, `remove`, `removePage`, `list(pageId)`, `usage(pageId)`. Adapters: `createMemoryBlobStore`, `createIndexedDbBlobStore` (object store `blobs`, indexed by page; schema version 3).

Limits (defaults, overridable): 25 MiB per file, 250 MiB per page, types `image/*`, `video/*`, `audio/*`, `application/pdf`. A refused file rejects with `BlobLimitError` (`too_large`, `page_limit`, `type_not_allowed`, with the limit) before anything is written; a full browser rejects with `StorageQuotaError`. Replacing an id counts only the new size. These numbers are placeholders chosen here, not user decisions, and the editor must show them to the user when it refuses a file.

Not done: nothing uses the blob store yet (the media plugin still embeds data URLs; moving it over and migrating existing data URLs out of stored pages is the media worker's step, with the old copy kept until the move is verified); no orphan cleanup when a block holding a file id is deleted or a page version is dropped; `deleteForever` removes a page's files only when the registry is given a `blobs` store (the demo does not create one yet); blob changes are not announced to other tabs; object URLs for display must be created and revoked by the reader. jsdom's fake IndexedDB does not keep a Blob's `type` on the stored object, so the tests check the record's `type`; a real Chrome run checked that bytes, `instanceof Blob`, type and a refusal round-trip.

## History and comments storage

Version history and comment threads read and write through `getSidecarStorage()` (localStorage by default, so
existing hosts are unchanged). A host can call `setSidecarStorage(createIndexedDbSidecar())` after
`await sidecar.ready()` and before the editor mounts. The demo does this in `prepareSidecar()`; if opening
IndexedDB fails, history and comments stay in localStorage. Reads are served from memory and writes are stored
in the background, so a failed write is reported through `onWriteError` and `flush()` (the demo sets
`sidecarWriteFailed`) instead of throwing. Older localStorage copies are imported once per key and left in
place; a record changed or removed in IndexedDB is not brought back from them.

The demo shows a fixed bottom bar ("Version history or comments could not be saved on this device") with Try again, which calls `retry()` (rewrites everything held in memory) and clears the bar only when that write is stored. The existing save errors and conflict bar use the same fixed placement so they are seen wherever the reader is scrolled.

Not covered: a second tab's history or comments are
not live-updated, and the pagehide flush is best effort. Checked in desktop Chrome only: a typed edit created
a version record in IndexedDB that survived a reload.
