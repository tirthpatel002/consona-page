import type { JSONContent } from '@tiptap/core'
import { composePlugins, PageEditor, usePageController } from '../src/editor/core'
import initialDoc from './content/initial-doc.json'
import { loadPersistedDoc } from '../src/plugins/persistence'
import { PageBanner } from '../src/utils/banner/PageBanner'
import { PageToolbar } from './PageToolbar'
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

// The demo persists edits locally under the stable id (see persistencePlugin); first visits and
// post-reset loads fall back to the sample document.
const initialContent: JSONContent = loadPersistedDoc(documentId) ?? initialDoc

const TITLE = 'Page'

export function App() {
  const page = usePageController({ registry, initialContent, documentId })
  return (
    <div className="app-frame">
      <PageBanner documentId={documentId} title={TITLE} />
      <PageToolbar page={page} />
      <PageEditor page={page} />
    </div>
  )
}
