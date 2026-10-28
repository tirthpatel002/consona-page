import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Ellipsis, FilePlus, Plus } from 'lucide-react'
import './PagesSidebar.css'
import { searchPages, type PageRecord, type PageSearchResult } from '../src/editor/core'
import { MenuFlyout } from '../src/editor/core/ui/MenuFlyout'
import { AiDialog } from './AiDialog'
import { showToast } from './toast'
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
  const moreAnchor = useRef<HTMLElement | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [destination, setDestination] = useState('')
  const [tree, setTree] = useState<readonly TreeNode[]>([])
  const [trashed, setTrashed] = useState<readonly PageRecord[]>([])
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<readonly PageSearchResult[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [failed, setFailed] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)

  const closeMenu = useCallback(() => {
    moreAnchor.current = null
    setMenuId(null)
  }, [])

  useEffect(() => {
    if (!menuId) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return closeMenu()
      if (target.closest('.page-menu-flyout')) return
      if (moreAnchor.current?.contains(target)) return
      closeMenu()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [menuId, closeMenu])

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
        () => {
          if (!cancelled) {
            setResults([])
            showToast('Search could not read the saved pages.', { tone: 'error' })
          }
        },
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
      showToast(error instanceof Error ? error.message : 'That did not work.', { tone: 'error' })
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
      if (!title) return
      await demoRegistry.rename(id, title)
      showToast(`Renamed to "${title}".`)
    })

  const trash = (record: PageRecord) =>
    run(async () => {
      const currentPath = record.id === currentId ? [] : await demoRegistry.path(currentId)
      const hidesCurrent = record.id === currentId || currentPath.some((parent) => parent.id === record.id)
      const done = await demoRegistry.moveToTrash(record.id)
      showToast(`"${record.title}" moved to trash.`, {
        undo: async () => {
          await done.undo()
          onChanged()
        },
      })
      if (hidesCurrent) onCurrentTrashed(record.parentId)
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
      showToast(`Moved "${record.title}".`, {
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

  const siblingsOf = (record: PageRecord) => records.filter((r) => r.parentId === record.parentId)
  const openMore = (record: PageRecord, button: HTMLElement) => {
    if (menuId === record.id) {
      closeMenu()
      return
    }
    moreAnchor.current = button
    setMenuId(record.id)
  }
  const menuRecord = menuId ? records.find((r) => r.id === menuId) : undefined

  const row = (node: TreeNode, depth: number) => {
    const title = node.record.title || 'Untitled'
    return (
      <li key={node.record.id}>
        <div
          className={`pages-row${menuId === node.record.id ? ' is-menu-open' : ''}`}
          style={{ paddingLeft: `${String(0.5 + depth * 0.9)}rem` }}
        >
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
              onClick={(event) => {
                onOpen(node.record.id)
                event.currentTarget.blur()
              }}
            >
              {title}
            </button>
          )}
          <span className="pages-actions">
            <button
              type="button"
              aria-label={`Add a page inside ${title}`}
              onClick={() => void add(node.record.id)}
            >
              <FilePlus size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`More actions for ${title}`}
              aria-haspopup="menu"
              aria-expanded={menuId === node.record.id}
              onClick={(event) => openMore(node.record, event.currentTarget)}
            >
              <Ellipsis size={15} aria-hidden="true" />
            </button>
          </span>
        </div>
        {node.children.length > 0 && <ul>{node.children.map((child) => row(child, depth + 1))}</ul>}
      </li>
    )
  }

  const movingRecord = moving ? records.find((r) => r.id === moving) : undefined
  const moveTargets = useMemo(() => {
    if (!movingRecord) return []
    const blocked = descendants(movingRecord.id)
    const walk = (nodes: readonly TreeNode[], depth: number): { id: string; title: string; depth: number }[] =>
      nodes.flatMap((node) => {
        if (blocked.has(node.record.id)) return []
        return [
          { id: node.record.id, title: node.record.title || 'Untitled', depth },
          ...walk(node.children, depth + 1),
        ]
      })
    return walk(tree, 0)
  }, [movingRecord, tree, records])

  const menuSiblings = menuRecord ? siblingsOf(menuRecord) : []
  const menuTitle = menuRecord?.title || 'Untitled'
  const canMoveUp = !!menuRecord && menuSiblings[0]?.id !== menuRecord.id
  const canMoveDown = !!menuRecord && menuSiblings.at(-1)?.id !== menuRecord.id

  return (
    <nav className="pages-sidebar" aria-label="Pages">
      {movingRecord && (
        <AiDialog title="Move page" close={() => setMoving(null)}>
          <p className="ai-muted">
            Choose a new parent for <strong>{movingRecord.title || 'Untitled'}</strong>.
          </p>
          <div className="pages-move-destinations" role="listbox" aria-label="Move destination">
            <button
              type="button"
              role="option"
              aria-selected={destination === ''}
              className={destination === '' ? 'is-selected' : undefined}
              onClick={() => setDestination('')}
            >
              Top level
            </button>
            {moveTargets.map((target) => (
              <button
                key={target.id}
                type="button"
                role="option"
                aria-selected={destination === target.id}
                className={destination === target.id ? 'is-selected' : undefined}
                style={{ paddingLeft: `${String(0.75 + target.depth * 0.9)}rem` }}
                onClick={() => setDestination(target.id)}
              >
                {target.title}
              </button>
            ))}
          </div>
          <footer className="ai-dialog__actions">
            <button type="button" onClick={() => setMoving(null)}>
              Cancel
            </button>
            <button type="button" onClick={() => void move(movingRecord, destination || null)}>
              Move here
            </button>
          </footer>
        </AiDialog>
      )}
      <MenuFlyout
        open={!!menuRecord}
        getAnchor={() => moreAnchor.current?.getBoundingClientRect() ?? null}
        label={`Actions for ${menuTitle}`}
        onClose={closeMenu}
        entries={
          menuRecord
            ? [
                {
                  id: 'rename',
                  label: 'Rename',
                  onSelect: () => {
                    renameActive.current = menuRecord.id
                    setDraft(menuRecord.title)
                    setRenaming(menuRecord.id)
                  },
                },
                {
                  id: 'trash',
                  label: 'Move to trash',
                  danger: true,
                  onSelect: () => {
                    void trash(menuRecord)
                  },
                },
                {
                  id: 'move',
                  label: 'Move…',
                  onSelect: () => {
                    setMoving(menuRecord.id)
                    setDestination(menuRecord.parentId ?? '')
                  },
                },
                ...(canMoveUp
                  ? [
                      {
                        id: 'up',
                        label: 'Move up',
                        onSelect: () => {
                          reorder(menuRecord, -1)
                        },
                      },
                    ]
                  : []),
                ...(canMoveDown
                  ? [
                      {
                        id: 'down',
                        label: 'Move down',
                        onSelect: () => {
                          reorder(menuRecord, 1)
                        },
                      },
                    ]
                  : []),
              ]
            : []
        }
      />
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
