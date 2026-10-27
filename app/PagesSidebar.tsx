import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, CornerDownRight, FilePlus, Pencil, Trash2, Plus, X } from 'lucide-react'
import './PagesSidebar.css'
import { searchPages, type PageRecord, type PageSearchResult } from '../src/editor/core'
import { demoPages, demoRegistry } from './demoSession'

interface TreeNode {
  readonly record: PageRecord
  readonly children: readonly TreeNode[]
}

async function loadTree(parentId: string | null, depth = 0): Promise<TreeNode[]> {
  if (depth > 12) return []
  const records = await demoRegistry.children(parentId)
  return Promise.all(records.map(async (record) => ({ record, children: await loadTree(record.id, depth + 1) })))
}

interface Props {
  readonly currentId: string
  readonly onOpen: (id: string) => void
  /** Called after the open page was trashed, with the page to show instead (or null for a new one). */
  readonly onCurrentTrashed: (parentId: string | null) => void
  readonly version: number
  readonly onChanged: () => void
}

/** The page tree: open, add, rename, move to trash and restore, plus search across pages. */
export function PagesSidebar({ currentId, onOpen, onCurrentTrashed, version, onChanged }: Props) {
  const renameActive = useRef<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [destination, setDestination] = useState('')
  const [tree, setTree] = useState<readonly TreeNode[]>([])
  const [trashed, setTrashed] = useState<readonly PageRecord[]>([])
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState<{ text: string; undo?: () => Promise<void> } | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<readonly PageSearchResult[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [failed, setFailed] = useState(false)

  const refresh = useCallback(
    () =>
      Promise.all([loadTree(null), demoRegistry.trash()]).then(
        ([nextTree, nextTrash]) => {
          setTree(nextTree)
          setTrashed(nextTrash)
          setFailed(false)
        },
        () => setFailed(true),
      ),
    [],
  )
  useEffect(() => {
    void refresh()
  }, [refresh, version])

  useEffect(() => {
    if (query.trim() === '') return
    let cancelled = false
    const timer = setTimeout(() => {
      searchPages({ registry: demoRegistry, pages: demoPages }, query).then(
        (found) => {
          if (cancelled) return
          setResults(found.results)
          setTruncated(found.truncated)
        },
        () => !cancelled && setNote({ text: 'Search could not read the saved pages.' }),
      )
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, version])

  const run = async (action: () => Promise<void>) => {
    try {
      await action()
      onChanged()
    } catch (error) {
      setNote({ text: error instanceof Error ? error.message : 'That did not work.' })
    }
  }

  const add = (parentId: string | null) =>
    run(async () => {
      const created = await demoRegistry.create({ parentId, title: 'Untitled' })
      onOpen(created.id)
    })

  const finishRename = (id: string) =>
    run(async () => {
      if (renameActive.current !== id) return
      renameActive.current = null
      setRenaming(null)
      const title = draft.trim()
      if (title) await demoRegistry.rename(id, title)
    })

  const trash = (record: PageRecord) =>
    run(async () => {
      const done = await demoRegistry.moveToTrash(record.id)
      setNote({
        text: `"${record.title}" moved to trash.`,
        undo: async () => {
          await done.undo()
          onChanged()
        },
      })
      if (record.id === currentId) onCurrentTrashed(record.parentId)
    })

  const flatten = (nodes: readonly TreeNode[]): PageRecord[] => nodes.flatMap((n) => [n.record, ...flatten(n.children)])
  const records = flatten(tree)
  const descendants = (id: string): Set<string> => {
    const blocked = new Set([id])
    for (let i = 0; i < records.length; i += 1)
      for (const r of records) if (r.parentId && blocked.has(r.parentId)) blocked.add(r.id)
    return blocked
  }
  const move = (record: PageRecord, parentId: string | null, index?: number) =>
    run(async () => {
      const done = await demoRegistry.move(record.id, parentId, index)
      setMoving(null)
      setNote({
        text: `Moved "${record.title}".`,
        undo: async () => {
          await done.undo()
          onChanged()
        },
      })
    })
  const reorder = (record: PageRecord, direction: -1 | 1) => {
    const siblings = records.filter((r) => r.parentId === record.parentId)
    const index = siblings.findIndex((r) => r.id === record.id) + direction
    if (index >= 0 && index < siblings.length) void move(record, record.parentId, index)
  }

  const row = (node: TreeNode, depth: number) => (
    <li key={node.record.id}>
      <div className="pages-row" style={{ paddingLeft: `${String(0.5 + depth * 0.9)}rem` }}>
        {renaming === node.record.id ? (
          <input
            className="pages-rename"
            aria-label="Page title"
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void finishRename(node.record.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void finishRename(node.record.id)
              if (event.key === 'Escape') {
                renameActive.current = null
                setRenaming(null)
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="pages-open"
            aria-current={node.record.id === currentId ? 'page' : undefined}
            onClick={() => onOpen(node.record.id)}
          >
            {node.record.title || 'Untitled'}
          </button>
        )}
        <span className="pages-actions">
          <button
            type="button"
            aria-label={`Add a page inside ${node.record.title}`}
            onClick={() => void add(node.record.id)}
          >
            <FilePlus size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Rename ${node.record.title}`}
            onClick={() => {
              renameActive.current = node.record.id
              setDraft(node.record.title)
              setRenaming(node.record.id)
            }}
          >
            <Pencil size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${node.record.title} to trash`}
            onClick={() => void trash(node.record)}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${node.record.title}`}
            onClick={() => {
              setMoving(node.record.id)
              setDestination(node.record.parentId ?? '')
            }}
          >
            <CornerDownRight size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${node.record.title} up`}
            disabled={records.filter((r) => r.parentId === node.record.parentId)[0]?.id === node.record.id}
            onClick={() => reorder(node.record, -1)}
          >
            <ArrowUp size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${node.record.title} down`}
            disabled={records.filter((r) => r.parentId === node.record.parentId).at(-1)?.id === node.record.id}
            onClick={() => reorder(node.record, 1)}
          >
            <ArrowDown size={15} aria-hidden="true" />
          </button>
        </span>
      </div>
      {moving === node.record.id && (
        <form
          className="pages-move"
          onSubmit={(e) => {
            e.preventDefault()
            void move(node.record, destination || null)
          }}
        >
          <label>
            Move to
            <select
              aria-label="Parent page"
              autoFocus
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              <option value="">Top level</option>
              {records
                .filter((r) => !descendants(node.record.id).has(r.id))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title || 'Untitled'}
                  </option>
                ))}
            </select>
          </label>
          <button type="submit">Move</button>
          <button type="button" aria-label="Cancel move" onClick={() => setMoving(null)}>
            <X size={15} />
          </button>
        </form>
      )}
      {node.children.length > 0 && <ul>{node.children.map((child) => row(child, depth + 1))}</ul>}
    </li>
  )

  return (
    <nav className="pages-sidebar" aria-label="Pages">
      <input
        type="search"
        className="pages-search"
        placeholder="Search pages"
        aria-label="Search pages"
        value={query}
        onChange={(event) => {
          setResults(null)
          setQuery(event.target.value)
        }}
      />
      {note && (
        <div className="pages-note" role="status">
          <span>{note.text}</span>
          {note.undo && (
            <button
              type="button"
              onClick={() => {
                const undo = note.undo
                setNote(null)
                if (undo) void run(undo)
              }}
            >
              Undo
            </button>
          )}
          <button type="button" onClick={() => setNote(null)}>
            Dismiss
          </button>
        </div>
      )}
      {failed && (
        <div className="pages-note" role="alert">
          The page list could not be read.{' '}
          <button type="button" onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      )}
      {query.trim() !== '' ? (
        results ? (
          <ul className="pages-results" aria-label="Search results">
            {results.length === 0 && <li className="pages-empty">No pages match.</li>}
            {results.map((result) => (
              <li key={result.pageId}>
                <button type="button" className="pages-open" onClick={() => onOpen(result.pageId)}>
                  <strong>{result.title || 'Untitled'}</strong>
                  {result.path.length > 0 && <small> in {result.path.join(' / ')}</small>}
                  {result.hits[0] && <small className="pages-excerpt">{result.hits[0].excerpt}</small>}
                </button>
              </li>
            ))}
            {truncated && <li className="pages-empty">Only part of your pages was searched.</li>}
          </ul>
        ) : (
          <p className="pages-empty" role="status">
            Searching pages…
          </p>
        )
      ) : (
        <>
          <ul className="pages-tree">{tree.map((node) => row(node, 0))}</ul>
          <div className="pages-new">
            <button type="button" onClick={() => void add(null)}>
              <Plus size={16} aria-hidden="true" /> New page
            </button>
          </div>
          {trashed.length > 0 && (
            <details className="pages-trash">
              <summary>Trash ({trashed.length})</summary>
              <ul>
                {trashed.map((record) => (
                  <li key={record.id} className="pages-row">
                    <span>{record.title || 'Untitled'}</span>
                    <span className="pages-actions">
                      <button
                        type="button"
                        onClick={() => void run(async () => void (await demoRegistry.restore(record.id)))}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${record.title}" and everything inside it for good? This cannot be undone.`,
                            )
                          )
                            void run(() => demoRegistry.deleteForever(record.id))
                        }}
                      >
                        Delete forever
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </nav>
  )
}
