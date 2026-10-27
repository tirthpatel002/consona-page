import { useEffect, useState } from 'react'
import * as z from 'zod/mini'
import {
  blockPlugin,
  defineBlock,
  searchPages,
  type BlobStore,
  type PageListRegistry,
  type PageStore,
} from '../../editor/core'
import { PagePreview } from './index'

export interface PagePreviewHost {
  readonly registry: PageListRegistry
  readonly pages: PageStore
  readonly blobs?: BlobStore
  readonly pageId: () => string
  readonly onOpen: (id: string) => void
}

export const pageReferenceSchema = z.object({ pageId: z.string().check(z.maxLength(200)) })

function ReferencePicker({
  host,
  onChoose,
}: {
  readonly host: PagePreviewHost
  readonly onChoose: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [choices, setChoices] = useState<readonly { id: string; title: string }[]>([])
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      const load = async () => {
        if (query.trim()) {
          const found = await searchPages(host, query, { limit: 30 })
          return found.results.map((r) => ({ id: r.pageId, title: r.title }))
        }
        const out: { id: string; title: string }[] = []
        const seen = new Set<string>()
        const walk = async (parent: string | null) => {
          for (const r of await host.registry.children(parent)) {
            if (seen.has(r.id) || out.length >= 100) continue
            seen.add(r.id)
            out.push(r)
            await walk(r.id)
          }
        }
        await walk(null)
        return out
      }
      void load().then(
        (list) => {
          if (!cancelled) {
            setChoices(list.filter((p) => p.id !== host.pageId()))
            setError(false)
          }
        },
        () => {
          if (!cancelled) setError(true)
        },
      )
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [host, query])
  return (
    <div className="page-reference-picker" role="group" aria-label="Choose a page to reference">
      <label>
        Link to a page
        <input type="search" placeholder="Search pages" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="page-reference-picker__choices">
        {error ? (
          <p role="status">Pages could not be loaded. Change the search to retry.</p>
        ) : choices.length ? (
          choices.map((p) => (
            <button key={p.id} type="button" onClick={() => onChoose(p.id)}>
              {p.title || 'Untitled'}
            </button>
          ))
        ) : (
          <p role="status">No other pages found.</p>
        )}
      </div>
    </div>
  )
}

/** An in-body reference stores only the page id, never a title/body snapshot or another editable editor. */
export function createPagePreviewPlugin(host: PagePreviewHost) {
  const block = defineBlock<{ pageId: string }>({
    type: 'pageReference',
    title: 'Page reference',
    description: 'A linked page with a clipped preview',
    keywords: ['subpage', 'page', 'link', 'preview'],
    schema: pageReferenceSchema,
    template: () => ({ pageId: '' }),
    presentation: { feedback: 'shell' },
    render: (props, context) =>
      props.pageId ? (
        <PagePreview {...host} pageId={props.pageId} parentId={host.pageId()} />
      ) : context.editable ? (
        <ReferencePicker host={host} onChoose={(id) => context.update({ pageId: id })} />
      ) : (
        <div className="page-preview page-preview--notice">No page linked</div>
      ),
  })
  return blockPlugin(block)
}
