import { useEffect, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import { composePlugins, PageEditor, usePageController } from '../src/editor/core'
import initialDoc from './content/initial-doc.json'
import { PageBanner } from '../src/utils/banner/PageBanner'
import { loadDemoPage, MissingPageError, openOlderLocalCopy } from './demoSession'
import { PageToolbar } from './PageToolbar'
import { SaveStatus } from './SaveStatus'
import { SidecarStatus } from './SidecarStatus'
import { pagePlugins } from './plugins'
import '../src/utils/banner/banner.css'

// Composed once at module load: conflicts fail fast at startup, not mid-edit.
const registry = composePlugins(pagePlugins)
// The demo has one document and no account/workspace layer, so its identity is a UUID created
// once and persisted locally - stable across reloads and title changes, never reused by a second
// document (a real host app passes its own document/workspace IDs instead).
const DOCUMENT_ID_KEY = 'page:document:id'
const documentId = ((): string => {
  try {
    const existing = localStorage.getItem(DOCUMENT_ID_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    localStorage.setItem(DOCUMENT_ID_KEY, created)
    return created
  } catch {
    return 'demo-document'
  }
})()

const TITLE = 'Page'

type Load =
  | { readonly state: 'missing'; readonly older: JSONContent | null }
  | { readonly state: 'loading' }
  | { readonly state: 'error' }
  | { readonly state: 'ready'; readonly content: JSONContent }

function Page({ initialContent }: { readonly initialContent: JSONContent }) {
  const page = usePageController({ registry, initialContent, documentId })
  // Errors from every status component gather in one fixed stack, so two at once never cover each other.
  const [errorHost, setErrorHost] = useState<HTMLElement | null>(null)
  return (
    <div className="app-frame">
      <div className="app-error-stack" ref={setErrorHost} />
      <PageBanner documentId={documentId} title={TITLE} />
      <PageToolbar page={page} />
      {page.editor && <SaveStatus editor={page.editor} errorHost={errorHost} />}
      <SidecarStatus errorHost={errorHost} />
      <PageEditor page={page} />
    </div>
  )
}

/**
 * Loads the saved page before the editor exists, so a late read can never replace text the user
 * already typed. A failed read does not open an editable sample, because the first save would
 * overwrite what is stored.
 */
export function App() {
  const [attempt, setAttempt] = useState(0)
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  useEffect(() => {
    let cancelled = false
    loadDemoPage(documentId).then(
      (loaded) => {
        if (!cancelled) setLoad({ state: 'ready', content: loaded.content ?? initialDoc })
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
  }, [attempt])

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
            <button type="button" onClick={() => setLoad({ state: 'ready', content: initialDoc })}>
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
  return <Page initialContent={load.content} />
}
