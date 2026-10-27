# Page store

A storage adapter that keeps pages by stable id, one body per id. It is exported from the editor core.

- `PageStore`: `get`, `put`, `remove`, `list`. Writes reject on failure so callers can show it.
- `put(id, doc, { expectedRevision })` is atomic with its check. A number means "only if the stored revision is this", `null` means "only if the page does not exist", and omitting it writes unconditionally. A mismatch throws `StaleRevisionError` and writes nothing.
- `createMemoryStore()` for tests and hosts that persist elsewhere.
- `createIndexedDbStore({ name, migrateLegacyLocalStorage })` for the browser. With migration on, the first `get` of an id with nothing stored imports the old `page:doc:<id>` localStorage copy and leaves it in place.

Status: the demo saves through this store (IndexedDB, with a localStorage adapter as fallback). Adapters are tested against memory, an in-memory IndexedDB fake, and, for the demo flow, a real desktop Chrome run (legacy import, edit and reload, two-tab conflict, forced write failure and retry). Not done: the page registry, hierarchy, trash and move, cross-tab change events, large-media quota handling, and other browsers.
