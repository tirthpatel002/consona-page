import type { Editor, JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { BlockGutter } from './gutter/BlockGutter'
import { PanelStore } from './plugin/panelStore'
import type { PageRegistry } from './registry/composePlugins'
import { turnIntoBubbleItem } from './block/turnIntoToolbar'
import { createExtensions, type EditorUiStores } from './registry/createExtensions'
import { SlashMenu } from './slash/SlashMenu'
import { SlashStore } from './slash/slashStore'
import { BlockToolbar } from './toolbar/BlockToolbar'
import { documentIdentityExtension } from './identity'
import type { PageSettingsStore } from './store'
import { VersionStore } from './versions/versionStore'
import { BubbleToolbar } from './toolbar/BubbleToolbar'
import './styles/editor.css'

export interface PageControllerOptions {
  readonly registry: PageRegistry
  readonly initialContent: JSONContent
  /**
   * Stable identity of this document; version history is stored under it
   * (`page:versions:<documentId>`), never shared across documents. Required: a title fallback
   * would collide across same-title documents and disconnect history on rename. When an
   * account/workspace layer exists, namespace the id with it before passing it here.
   */
  readonly documentId: string
  /**
   * Where the page lock is kept. With it, a locked page stays locked after a reload and code that works on
   * a closed page can see the lock. Without it the lock lasts for this session only. If saving the lock
   * fails, `lockSaveFailed` is true and the lock may not be seen by code working on the closed page.
   */
  readonly settings?: PageSettingsStore
}

/**
 * Editor session the host app owns. The top toolbar is not part of the surface: the app renders
 * one beside it, or leaves it out.
 */
export interface PageController {
  readonly editor: Editor | null
  readonly registry: PageRegistry
  readonly locked: boolean
  /** True when the last attempt to save the lock to the page settings failed. */
  readonly lockSaveFailed: boolean
  readonly openPanels: ReadonlySet<string>
  readonly togglePanel: (id: string) => void
  readonly versionStore: VersionStore | null
  readonly ui: EditorUiStores
}

/** Creates the editor, panel store and version history. The host decides which chrome to render. */
export function usePageController({
  registry,
  initialContent,
  documentId,
  settings,
}: PageControllerOptions): PageController {
  const ui = useMemo(() => ({ slash: new SlashStore(), panels: new PanelStore() }), [])
  const extensions = useMemo(
    () => [...createExtensions(registry, ui), documentIdentityExtension.configure({ documentId })],
    [registry, ui, documentId],
  )
  // The lock lives in the editor's storage; mirroring it into React state lets `editable` flow through
  // useEditor's options, which are re-applied on every render (a bare setEditable would be reverted).
  const [locked, setLocked] = useState(false)
  const editor = useEditor({ extensions, content: initialContent, editable: !locked }, [extensions])
  // StrictMode double-invokes this memo, but the discarded pass's store is never attached (the
  // effect owns the subscription), so only the committed store listens to transactions.
  const versionStore = useMemo(
    () => (editor ? new VersionStore(editor, { storageKey: `page:versions:${documentId}`, attach: false }) : null),
    [editor, documentId],
  )
  useEffect(() => {
    versionStore?.attach()
    return () => versionStore?.destroy()
  }, [versionStore])
  const openPanels = useSyncExternalStore(ui.panels.subscribe, ui.panels.getState)

  const [lockSaveFailed, setLockSaveFailed] = useState(false)
  useEffect(() => {
    if (!editor) return
    let cancelled = false
    let saved: boolean | null = null // the lock value last written (or read) from the settings
    const syncLock = () => {
      const now = editor.storage.pageLock?.locked ?? false
      setLocked(now)
      if (!settings || saved === null || now === saved) return
      saved = now
      settings.set(documentId, { locked: now }).then(
        () => {
          if (!cancelled) setLockSaveFailed(false)
        },
        () => {
          saved = !now // so the next change, or the next transaction, tries again
          if (!cancelled) setLockSaveFailed(true)
        },
      )
    }
    editor.on('transaction', syncLock)
    if (settings) {
      void settings.get(documentId).then(
        (value) => {
          if (cancelled || editor.isDestroyed) return
          saved = value.locked
          if (value.locked && !(editor.storage.pageLock?.locked ?? false)) editor.commands.setPageLocked(true)
          syncLock()
        },
        () => {
          saved = editor.storage.pageLock?.locked ?? false
          if (!cancelled) setLockSaveFailed(true)
        },
      )
    } else syncLock()
    return () => {
      cancelled = true
      editor.off('transaction', syncLock)
    }
  }, [editor, settings, documentId])

  return {
    editor,
    registry,
    locked,
    lockSaveFailed,
    openPanels,
    togglePanel: ui.panels.toggle,
    versionStore,
    ui,
  }
}

/** The editor surface: document, gutter, panels, bubble toolbar, slash menu and plugin overlays. */
export function PageEditor({ page }: { readonly page: PageController }) {
  const { editor, registry } = page
  const [documentEl, setDocumentEl] = useState<HTMLElement | null>(null)
  if (!editor) return null
  const visiblePanels = registry.panels.filter((panel) => page.openPanels.has(panel.id))
  const turnIntoDefinitions = registry.plugins.flatMap((plugin) => plugin.turnInto ?? [])

  return (
    <div className={`page-shell${page.locked ? ' page-shell--locked' : ''}`}>
      <div className={`page-layout${visiblePanels.length > 0 ? ' has-panel' : ''}`}>
        <main className="page-document" ref={setDocumentEl}>
          <EditorContent editor={editor} />
          {documentEl && (
            <BlockGutter
              editor={editor}
              container={documentEl}
              blocks={registry.blocks}
              blockActions={registry.blockActions}
              turnIntoDefinitions={turnIntoDefinitions}
              openPanel={page.ui.panels.show}
            />
          )}
        </main>
        {visiblePanels.map((panel) => (
          <aside className="page-panel" key={panel.id} aria-label={panel.label}>
            {panel.render(editor, page.ui)}
          </aside>
        ))}
      </div>
      <BubbleToolbar
        editor={editor}
        items={[
          ...registry.toolbarItems.filter((item) => item.placement === 'bubble' || item.placement === 'both'),
          ...(turnIntoDefinitions.length > 0 ? [turnIntoBubbleItem(turnIntoDefinitions)] : []),
        ]}
      />
      <SlashMenu store={page.ui.slash} />
      {registry.blockToolbars.map((definition) => (
        <BlockToolbar key={definition.id} editor={editor} definition={definition} />
      ))}
      {registry.overlays.map((overlay) => (
        <Fragment key={overlay.id}>{overlay.render(editor, page.ui)}</Fragment>
      ))}
    </div>
  )
}
