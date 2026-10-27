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
