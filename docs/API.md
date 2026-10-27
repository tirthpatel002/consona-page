# Public library API

## Package contract

The current development package is `page@0.1.0`, ESM only, still `private: true`. These are explicit exports;
internal paths are not a supported import surface. A future public name/version/license is a release decision.

| Import                | Purpose                                                                         | Runtime boundary                                       |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `page`, `page/react`  | Editor shell, controller, plugin/block authoring, operations, UI helpers        | Browser/client React                                   |
| `page/engine`         | `createPageEngine`, `createPagesEngine`, edit/result types, request logs        | Import without DOM; editing needs host Editor          |
| `page/store`          | Page stores, registry, blobs, settings, search, sidecars, migration/error types | No React; browser adapters need browser APIs when used |
| `page/compact`        | `toCompact` and compact/Markdown codec types                                    | No browser globals; accepts a schema-backed document   |
| `page/markdown`       | `fromMarkdown`, `parseInline`, `inlineToMarkdown`, `toMarkdown`                 | No browser UI                                          |
| `page/blocks`         | Built-in block plugins                                                          | Browser/client, optional heavy dependencies            |
| `page/plugins/<name>` | Individual feature plugins                                                      | Browser/client                                         |
| `page/styles.css`     | Core and built-in styles                                                        | Import once in host                                    |

Additional feature entries:

| Import                     | Purpose                                                                         | Runtime boundary                                        |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `page/ai-controller`       | `createAiReviewController`, `createMockAiProvider`, provider/review types       | No React or DOM; host supplies engine/settings/provider |
| `page/plugins/ai-review`   | Controller exports and `captureAiTargets`                                       | Browser/editor selection capture, React-bearing         |
| `page/blocks/page-preview` | `PagePreview`, `ChildPagePreviews`, `createPagePreviewPlugin`, host/props types | Browser/client React                                    |

Plugin names: `text`, `lists`, `columns`, `block-actions`, `block-selection`, `formatting`, `comments`, `emoji`,
`export`, `media`, `persistence`, `props-editor`, `json-view`. The AI review entry is listed separately above because selection capture pulls in browser editor code.
Application dialogs and Page Settings UI are not library exports; hosts can supply their own UI over the
controller/settings contracts. Page previews take a registry, page store, optional blobs and an open callback;
the reference plugin takes the same host plus the current page id function. No preview body is persisted twice.
Further feature entries must be added to the package export map and packed-consumer checks with their implementation.

Development/package tests use Node 22.23.4 (jsdom requires >=22.22.2 on the Node 22 line).
That test-tool minimum is not a library runtime minimum. No lower-Node compatibility matrix is claimed. React/React DOM are peer dependencies matching the tested
19.x line in package.json. Tiptap 3 is a direct dependency; custom extensions must use a compatible single
Tiptap/ProseMirror graph. Do not mix major versions or bundle a second copy of React. No CJS entry is built.

## Minimal React host

```tsx
import { composePlugins, PageEditor, usePageController } from 'page/react'
import { textPlugin } from 'page/plugins/text'
import { listsPlugin } from 'page/plugins/lists'
import 'page/styles.css'

const registry = composePlugins([textPlugin(), listsPlugin])
const initialContent = { type: 'doc', content: [{ type: 'paragraph' }] }

export function Document() {
  const controller = usePageController({
    registry,
    documentId: 'workspace:page-one',
    initialContent,
  })
  return <PageEditor page={controller} />
}
```

Use a client component when a framework separates server/client components. The library does not add or
promise framework-specific server-component directives. The host owns the toolbar/header and may render
`Toolbar` with its controller; the editor surface does not include one. Plugin composition must be stable,
not recreated on each render. `textPlugin()` expects `listsPlugin` to supply list nodes.

This example has no persistence. Load saved JSON before mounting the editor, then add
`createPersistencePlugin(session)` from `page/plugins/persistence`, where the session includes the store and
loaded numeric revision (or `null` for a new page). A per-document session function is supported for page
switching. Do not omit expected revisions in a multi-tab application. Provide `settings` to
`usePageController` for persistent locks. Do not enable editing before settings have loaded.

## Host-owned services

The core is composition-oriented: no demo page, sample content, network AI provider, database account or
telemetry is automatically installed by importing a public entry. Adapters are host choices.

- Storage: memory for tests or external persistence; IndexedDB for a browser. Reads/writes reject on errors.
- Media: `createMediaPlugin({ blobs, pageId })` stores file references; `inlineStoredFiles` prepares portable
  exports, and `migrateInlineMedia` is explicit. Keep all versions' references when sweeping files.
- Settings: `createSettingsStore(storage)` stores per-page locks and `aiReview: 'ask' | 'apply'`.
- Comments/history: a sidecar can be installed before mounting. Saving bodies and saving sidecars are
  different operations; surface both failure states.
- AI: host-supplied provider and explicit disclosure scope, never a built-in paid provider. Review is default;
  opting out does not bypass validation, locks or stale checks.

Media/export host configuration and sidecar selection are currently module-scoped. Do not claim isolated
concurrent multi-tenant hosts in the same JavaScript realm. Authorization, server persistence, authentication,
backup policy, collaboration and remote URL privacy are host responsibilities.

## Styling and safety

Override `--page-*` tokens on the editor ancestor. The package stylesheet includes all built-in plugin styles;
styles are declared side effects so bundlers retain them. Heavy JS remains in optional entries/dependencies.

Treat documents and imported Markdown/HTML as untrusted. Schema checks and URL allowlists are defense layers,
not an HTML sandbox for arbitrary custom plugin renderers. Keep custom block renderers free of untrusted raw
HTML and audit any additional URL-bearing props. Read-only compact directives are context, not executable
instructions or a write grammar.
