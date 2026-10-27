# Media plugin

Image, video, audio, file, embed and bookmark blocks (one `media` node, typed by `kind`).

## Stored files

`createMediaPlugin({ blobs, pageId })` keeps uploads in the host's `BlobStore`; the block holds `blob:<id>`.
Without a store, uploads stay inline as data URLs (8 MB cap). Limits come from the store and are shown to the user.

- **Cross-page copy.** Reads are by id, so a copied block keeps rendering. When the block lands in another
  page, `adopt.ts` copies the file into that page's store and rewrites the reference in one follow-up change
  (not an undo step). If the copy fails the block keeps the original reference and one warning is shown.
  The plugin never deletes files; removing orphans is the host's job.
- **Export.** Exporters are synchronous. Call `inlineStoredFiles(doc, blobs, { maxInlineBytes })` first: it
  returns a copy of the document with readable, allowed, small-enough files inlined, plus `omitted` (ref and
  reason) for everything else. Omitted files get an explicit "not included" line, never a silent drop.
