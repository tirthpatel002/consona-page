import { useCallback, useEffect, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import { composePlugins, PageEditor, usePageController } from '../src/editor/core'
import initialDoc from './content/initial-doc.json'
import { PageBanner } from '../src/utils/banner/PageBanner'
import {
  demoDocumentId,
  demoBlobs,
  demoPages,
  demoRegistry,
  demoSettings,
  getSidecarFailed,
  loadDemoPage,
  MissingPageError,
  openOlderLocalCopy,
  setCurrentPageId,
} from './demoSession'
import { PagesSidebar } from './PagesSidebar'
import { StorageTools } from './StorageTools'
import { collectPageReferenceIds } from './pageRefs'
import { AiTools } from './AiTools'
import { PageToolbar } from './PageToolbar'
import { inStack, SaveStatus } from './SaveStatus'
import { SidecarStatus } from './SidecarStatus'
import { ExportNotice } from './ExportNotice'
import { demoPagesEngine } from './pagesEngine'
import { openPageById, setOpenPageHandler } from './navigation'
import { ChildPagePreviews } from '../src/blocks/page-preview'
import { startTabResponder } from './tabCoordination'
import { pagePlugins } from './plugins'
import '../src/utils/banner/banner.css'

// Composed once at module load: conflicts fail fast at startup, not mid-edit.
const registry = composePlugins(pagePlugins)
const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }
const CURRENT_KEY = 'page:current:id'
const rememberedId = (): string => {
  try {
    return localStorage.getItem(CURRENT_KEY) ?? demoDocumentId
  } catch {
    return demoDocumentId
  }
}

type Load =
  | { readonly state: 'missing'; readonly older: JSONContent | null }
  | { readonly state: 'loading' }
  | { readonly state: 'error' }
  | { readonly state: 'ready'; readonly content: JSONContent }

function Page({
  documentId,
  title,
  initialContent,
  previewVersion,
}: {
  readonly previewVersion: number
  readonly documentId: string
  readonly title: string
  readonly initialContent: JSONContent
}) {
  const page = usePageController({ registry, initialContent, documentId, settings: demoSettings })
  // While this page is open the engine edits it through this editor, so history and autosave see engine edits.
  const openEditor = page.editor
  const [bodyRefs, setBodyRefs] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    if (!openEditor) return
    const sync = () => setBodyRefs(collectPageReferenceIds(openEditor.getJSON()))
    const first = window.setTimeout(sync, 0)
    openEditor.on('update', sync)
    return () => {
      window.clearTimeout(first)
      openEditor.off('update', sync)
    }
  }, [openEditor])
  useEffect(() => {
    if (!openEditor) return
    const detach = demoPagesEngine.attach(documentId, openEditor)
    // Other tabs ask before deleting files: this tab is "dirty" while saving, after a failure and for a few seconds after an edit.
    let lastEdit = 0
    const onUpdate = () => {
      lastEdit = Date.now()
    }
    openEditor.on('update', onUpdate)
    const responder = startTabResponder(() => {
      const status = openEditor.storage.docPersistence?.status as string | undefined
      return (
        Date.now() - lastEdit < 5000 ||
        (status !== undefined && status !== 'idle' && status !== 'saved') ||
        getSidecarFailed()
      )
    })
    return () => {
      detach()
      openEditor.off('update', onUpdate)
      responder.stop()
    }
  }, [openEditor, documentId])
  // Errors from every status component gather in one fixed stack, so two at once never cover each other.
  const [errorHost, setErrorHost] = useState<HTMLElement | null>(null)
  return (
    <div className="app-frame">
      <div className="app-error-stack" ref={setErrorHost} />
      <PageBanner documentId={documentId} title={title} />
      <PageToolbar page={page} />
      {page.editor && (
        <AiTools editor={page.editor} pageId={documentId} engine={demoPagesEngine} settings={demoSettings} />
      )}
      {page.editor && <SaveStatus editor={page.editor} errorHost={errorHost} />}
      <SidecarStatus errorHost={errorHost} />
      {page.lockSaveFailed &&
        inStack(
          errorHost,
          <div className="save-status is-error" role="alert">
            <span>
              The page lock could not be saved on this device. It holds in this tab, but may not apply after a reload or
              to tools that work on the closed page.
            </span>
          </div>,
        )}
      <ExportNotice host={errorHost} />
      <PageEditor page={page} />
      <ChildPagePreviews
        registry={demoRegistry}
        pages={demoPages}
        blobs={demoBlobs}
        parentId={documentId}
        excludeIds={bodyRefs}
        version={previewVersion}
        onOpen={openPageById}
      />
    </div>
  )
}

/**
 * Loads the saved page before the editor exists, so a late read can never replace text the user
 * already typed. A failed read does not open an editable sample, because the first save would
 * overwrite what is stored.
 */
function PageLoader({
  documentId,
  title,
  previewVersion,
}: {
  readonly documentId: string
  readonly title: string
  readonly previewVersion: number
}) {
  const fallback = documentId === demoDocumentId ? (initialDoc as JSONContent) : EMPTY_DOC // same for a given id
  const [attempt, setAttempt] = useState(0)
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  useEffect(() => {
    let cancelled = false
    setCurrentPageId(documentId)
    loadDemoPage(documentId).then(
      (loaded) => {
        if (!cancelled) setLoad({ state: 'ready', content: loaded.content ?? fallback })
      },
      (error: unknown) => {
        if (cancelled) return
        if (error instanceof MissingPageError) {
          void openOlderLocalCopy(documentId).then(
            (older) => !cancelled && setLoad({ state: 'missing', older: older?.content ?? null }),
            () => !cancelled && setLoad({ state: 'missing', older: null }),
          )
        } else setLoad({ state: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fallback` only depends on documentId
  }, [attempt, documentId])

  if (load.state === 'loading')
    return (
      <div className="app-frame app-status" role="status">
        Loading your page…
      </div>
    )
  if (load.state === 'missing') {
    const { older } = load
    return (
      <div className="app-frame app-status" role="alert">
        <section className="recovery" aria-labelledby="recovery-title">
          <h1 id="recovery-title" className="recovery__title">
            The saved page is missing
          </h1>
          <p>This page was saved in this browser before, but its saved copy is gone. Nothing was opened or changed.</p>
          {older && (
            <p>
              An older copy from before the storage upgrade exists. It may be out of date and will become the saved page
              if you open it.
            </p>
          )}
          <div className="app-status__actions">
            {older && (
              <button
                type="button"
                className="is-primary"
                autoFocus
                onClick={() => setLoad({ state: 'ready', content: older })}
              >
                Open the older copy
              </button>
            )}
            <button type="button" onClick={() => setLoad({ state: 'ready', content: fallback })}>
              Start with the sample page
            </button>
          </div>
        </section>
      </div>
    )
  }
  if (load.state === 'error') {
    return (
      <div className="app-frame app-status" role="alert">
        <section className="recovery">
          <h1 className="recovery__title">Could not read the saved page</h1>
          <p>It was not opened, and nothing was changed.</p>
          <button
            type="button"
            className="is-primary"
            autoFocus
            onClick={() => {
              setLoad({ state: 'loading' })
              setAttempt((n) => n + 1)
            }}
          >
            Try again
          </button>
        </section>
      </div>
    )
  }
  return <Page documentId={documentId} title={title} initialContent={load.content} previewVersion={previewVersion} />
}

/** The page list on the left and the open page on the right. Opening another page remounts the editor. */
export function App() {
  const [currentId, setCurrentId] = useState(rememberedId)
  const [version, setVersion] = useState(0)
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)

  // The demo page needs a record before the tree can show it. Creating it never touches its body.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!(await demoRegistry.get(demoDocumentId))) {
          await demoRegistry.create({ id: demoDocumentId, title: 'Launch notes' })
        }
      } catch {
        // The sidebar shows its own error; the page still opens.
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void demoRegistry.get(currentId).then(
      (record) => !cancelled && record && setTitles((prev) => ({ ...prev, [currentId]: record.title })),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [currentId, version])

  const openPage = useCallback((id: string) => {
    try {
      localStorage.setItem(CURRENT_KEY, id)
    } catch {
      // Remembering the page is a convenience only.
    }
    setCurrentId(id)
    setOpen(false)
  }, [])
  useEffect(() => setOpenPageHandler(openPage), [openPage])
  // After the open page is trashed: go to its live parent, else any live top-level page, else make a new one.
  const openAfterTrash = async (parentId: string | null) => {
    if (parentId) return openPage(parentId)
    try {
      const roots = await demoRegistry.children(null)
      const live = roots[0]
      if (live) return openPage(live.id)
      const created = await demoRegistry.create({ title: 'Untitled' })
      setVersion((v) => v + 1)
      openPage(created.id)
    } catch {
      // The sidebar shows its own error; stay on the current page.
    }
  }
  if (!ready)
    return (
      <div className="app-frame app-status" role="status">
        Loading your page…
      </div>
    )
  return (
    <div className="app-shell">
      <button type="button" className="pages-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Pages
      </button>
      <div className={open ? 'pages-pane is-open' : 'pages-pane'}>
        <PagesSidebar
          currentId={currentId}
          onOpen={openPage}
          onChanged={() => setVersion((v) => v + 1)}
          onCurrentTrashed={(parentId) => void openAfterTrash(parentId)}
          version={version}
        />
        <StorageTools currentId={currentId} />
      </div>
      <main className="app-main">
        <PageLoader
          key={currentId}
          documentId={currentId}
          title={titles[currentId] ?? 'Page'}
          previewVersion={version}
        />
      </main>
    </div>
  )
}
