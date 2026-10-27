import { useEffect, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import { composePlugins, PageEditor, usePageController } from '../src/editor/core'
import initialDoc from './content/initial-doc.json'
import { PageBanner } from '../src/utils/banner/PageBanner'
import { loadDemoPage } from './demoSession'
import { PageToolbar } from './PageToolbar'
import { SaveStatus } from './SaveStatus'
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
  | { readonly state: 'loading' }
  | { readonly state: 'error' }
  | { readonly state: 'ready'; readonly content: JSONContent }

function Page({ initialContent }: { readonly initialContent: JSONContent }) {
  const page = usePageController({ registry, initialContent, documentId })
  return (
    <div className="app-frame">
      <PageBanner documentId={documentId} title={TITLE} />
      <PageToolbar page={page} />
      {page.editor && <SaveStatus editor={page.editor} />}
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
      () => {
        if (!cancelled) setLoad({ state: 'error' })
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
  if (load.state === 'error') {
    return (
      <div className="app-frame app-status" role="alert">
        <p>Could not read the saved page, so it was not opened. Nothing was changed.</p>
        <button
          type="button"
          onClick={() => {
            setLoad({ state: 'loading' })
            setAttempt((n) => n + 1)
          }}
        >
          Try again
        </button>
      </div>
    )
  }
  return <Page initialContent={load.content} />
}
