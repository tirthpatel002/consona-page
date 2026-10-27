import { useEffect, useState } from 'react'
import { ArrowUpRight, FileText } from 'lucide-react'
import type { BlobStore, PageListRegistry, PageStore } from '../../editor/core'
import { readPreview, type PreviewState } from './model'
import { PreviewBody } from './PreviewBody'
import './page-preview.css'

export interface PagePreviewProps {
  readonly registry: PageListRegistry
  readonly pages: PageStore
  readonly blobs?: BlobStore
  readonly pageId: string
  readonly parentId?: string
  readonly version?: number
  readonly onOpen: (id: string) => void
}

export function PagePreview({ registry, pages, blobs, pageId, parentId, version, onOpen }: PagePreviewProps) {
  const [state, setState] = useState<PreviewState | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    let generation = 0
    const refresh = () => {
      const request = ++generation
      void readPreview(registry, pages, pageId, parentId).then(
        (next) => {
          if (!cancelled && request === generation) {
            setState(next)
            setFailed(false)
          }
        },
        () => {
          if (!cancelled && request === generation) {
            setState(null)
            setFailed(true)
          }
        },
      )
    }
    refresh()
    const unsubscribe = pages.subscribe?.((change) => {
      if (change.id === pageId) refresh()
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [registry, pages, pageId, parentId, version, attempt])
  if (failed)
    return (
      <div className="page-preview page-preview--notice" role="status">
        Preview could not be loaded.{' '}
        <button type="button" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </div>
    )
  if (!state)
    return (
      <div className="page-preview page-preview--notice" role="status">
        Loading page preview…
      </div>
    )
  if (state.status !== 'ready')
    return (
      <div className="page-preview page-preview--notice">
        {state.status === 'trashed'
          ? 'Page is in the trash'
          : state.status === 'cycle'
            ? 'This page cannot preview itself'
            : 'Page is unavailable'}
      </div>
    )
  return (
    <article className="page-preview">
      <button
        type="button"
        className="page-preview__open"
        onClick={() => onOpen(pageId)}
        aria-label={`Open ${state.title}`}
      >
        <span className="page-preview__title">
          <FileText size={18} />
          <strong>{state.title}</strong>
          <ArrowUpRight size={16} />
        </span>
        <span className="page-preview__description">Open page · Read-only preview</span>
      </button>
      {state.nodes.length ? (
        <PreviewBody nodes={state.nodes} blobs={blobs} />
      ) : (
        <div className="page-preview__empty">This page is empty.</div>
      )}
    </article>
  )
}

export interface ChildPagePreviewsProps extends Omit<PagePreviewProps, 'pageId' | 'parentId'> {
  readonly parentId: string
}

/** Child relationships stay in the registry. This view never inserts or copies child bodies into a parent. */
export function ChildPagePreviews({ parentId, registry, pages, blobs, version, onOpen }: ChildPagePreviewsProps) {
  const [ids, setIds] = useState<readonly string[]>([])
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    void registry.children(parentId).then(
      (records) => {
        if (!cancelled) {
          setIds(records.slice(0, 50).map((r) => r.id))
          setFailed(false)
        }
      },
      () => {
        if (!cancelled) {
          setIds([])
          setFailed(true)
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [registry, parentId, version, attempt])
  if (failed)
    return (
      <div className="page-preview--notice" role="status">
        Subpages could not be loaded.{' '}
        <button type="button" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </div>
    )
  if (!ids.length) return null
  return (
    <section className="page-previews" aria-label="Subpages">
      <h2>Inside this page</h2>
      {ids.map((id) => (
        <PagePreview
          key={id}
          registry={registry}
          pages={pages}
          blobs={blobs}
          pageId={id}
          parentId={parentId}
          version={version}
          onOpen={onOpen}
        />
      ))}
      {ids.length === 50 && (
        <p className="page-preview__description">
          Showing the first 50 subpages. All pages are available in the sidebar.
        </p>
      )}
    </section>
  )
}
