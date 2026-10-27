# Page store

A storage adapter that keeps pages by stable id, one body per id. It is exported from the editor core.

- `PageStore`: `get`, `put`, `remove`, `list`. Writes reject on failure so callers can show it.
- `put(id, doc, { expectedRevision })` is atomic with its check. A number means "only if the stored revision is this", `null` means "only if the page does not exist", and omitting it writes unconditionally. A mismatch throws `StaleRevisionError` and writes nothing.
- `createMemoryStore()` for tests and hosts that persist elsewhere.
- `createIndexedDbStore({ name, migrateLegacyLocalStorage })` for the browser. With migration on, the first `get` of an id with nothing stored imports the old `page:doc:<id>` localStorage copy and leaves it in place.

Status: the adapters are built and tested (memory and fake IndexedDB, concurrent writers, legacy import). The demo editor does not use them yet; it still saves through localStorage. Not done: wiring the editor to the store, a visible save indicator, storage-error display, cross-tab change events, the page registry, and large-media quota handling. Tested only against an in-memory IndexedDB fake, not a real browser.
