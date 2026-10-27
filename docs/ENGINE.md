# Programmatic editing guide

## One open page

```ts
import { createPageEngine } from 'page/engine'
import { fromMarkdown, parseInline, inlineToMarkdown } from 'page/markdown'

// editor is the host's already-created Tiptap Editor, with the same plugins as its UI.
const engine = createPageEngine({
  editor,
  markdown: {
    parseInline,
    parseBlocks: (text) => fromMarkdown(text).content ?? [],
    inlineToMarkdown,
  },
})
const outline = engine.outline({ maxChars: 80 })
const target = outline.blocks.find((block) => block.type === 'paragraph')
if (target) {
  const result = engine.edit({
    baseRevision: outline.revision,
    requestId: 'unique-request-id',
    steps: [{ op: 'replaceMarkdown', id: target.id, text: 'A **formatted** paragraph.' }],
  })
  if (!result.ok) {
    // Show errors; re-read on stale/unknown_revision. Never retry against a guessed revision.
    console.error(result.errors)
  }
}
```

The engine applies a validated batch through one transaction or refuses the whole batch. Supported steps:
`replaceText`, `insertParagraphAfter`, `replaceMarkdown`, `insertMarkdownAfter`, `delete`, `moveAfter`,
`setProps`. Plain text replacement drops marks; use the Markdown path to preserve formatting. Raw HTML stays
literal; Markdown links are checked. Media insertions and URL/file/embed props are not a generic engine write
path. New inserted blocks receive fresh ids. `setProps` checks primitive kind, not every plugin's semantics;
custom constraints still belong in the block/extension contract.

`readCompact({ ids, maxChars, maxLines })` returns bounded, id-addressed Markdown-like lines, with truncation
explicit. Non-text directives come from the schema and are read-only. A Markdown codec is required; without
one `readCompact` returns null and Markdown edits return `needs_markdown`. No token-saving percentage has been
measured.

The engine revision is a content fingerprint, not the numeric stored-page revision or a security hash. It
remembers recent revisions for touched-block stale checks; unrelated changes can proceed, but unknown/expired
revisions require a fresh read. A request id prevents duplicate application for that handle. Guarded `undo()`
writes the previous body as a new program change only if the current body still matches the prior result.
Undo and per-block revision memory are handle-local, not a durable workflow journal.

## Pages by id

```ts
import { Editor } from '@tiptap/core'
import { createPagesEngine, createLocalStorageRequestLog } from 'page/engine'
import { composePlugins, createExtensions, ensureBlockIds, PanelStore, SlashStore } from 'page/react'
import { textPlugin } from 'page/plugins/text'
import { listsPlugin } from 'page/plugins/lists'
import { fromMarkdown, parseInline, inlineToMarkdown } from 'page/markdown'

const plugins = composePlugins([textPlugin(), listsPlugin])
const pages = createPagesEngine({
  registry, // PageListRegistry: the page hierarchy, not the plugin composition registry
  store, // PageStore: one body per page id
  settings, // PageSettingsStore shared with the visible editor
  requestLog: createLocalStorageRequestLog(),
  markdown: { parseInline, parseBlocks: (text) => fromMarkdown(text).content ?? [], inlineToMarkdown },
  createEditor(doc) {
    const editor = new Editor({
      extensions: createExtensions(plugins, { panels: new PanelStore(), slash: new SlashStore() }),
      content: doc ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    })
    ensureBlockIds(editor)
    return { editor, destroy: () => editor.destroy() }
  },
})
```

This is browser/DOM code, even though the detached editor is never displayed. It must omit autosave and any
other plugin with external write effects. Include the same schema as the visible editor, or custom blocks may
be refused or lost. The host can supply a controlled DOM environment for tests; a server-only editor is not
implemented. Do not mount React or share a visible editor for the detached factory.

Call `attach(pageId, editor)` for an open page and call its returned detach function on unmount. Open-page
edits go through the visible editor/autosave. Closed-page edits read, validate in a detached editor and commit
once with `expectedRevision`; another writer produces `conflict`, not last-writer-wins. `ids_missing` means
open/migrate the old page through the editor first. Locked/trashed/unknown pages refuse writes.

The page API includes `children`, `search`, `create`, `rename`, `move`, `trash`, `restore`, `outline`,
`readCompact`, `edit`, `undo`. Permanent deletion is deliberately on the registry and is not an undoable edit.

## Retry and durability limits

The optional persisted request log retains only the latest 20 successful requests per page. An identical id
replays the earlier result without writing. Use globally unique ids per logical edit, not for distinct payloads.
Failed edits are not logged and may be retried after fixing the cause. A refused store write changes no body
and records no success.

Body and request-log writes are not one atomic durable transaction. A body write followed by a log failure
(or process death between them) can leave the edit applied without durable replay protection. No exactly-once
across crashes guarantee is made. Reload/re-read and reconcile before retrying an uncertain outcome. Open-page
autosave is also separate from edit completion: a successful edit result is not proof of durable save. Surface
page and sidecar save errors.

Closed-page undo is in memory and refuses when the stored revision moved. UI history receives the `program`
change kind, but does not display kinds. AI review bypass never bypasses locks, validation or stale checks;
remote provider disclosure and permissions remain a host concern.
