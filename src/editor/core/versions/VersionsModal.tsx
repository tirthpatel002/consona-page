import { useEffect, useMemo, useState } from 'react'
import type { AnyExtension, Editor, JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { Icon } from '../ui/Icon'
import type { VersionEntry } from './types'
import type { VersionStore } from './versionStore'

const CURRENT = 'current'

/** A second editor needs its own extension instances. Copying config leaves the live editor's instances alone. */
const forkExtension = (extension: AnyExtension): AnyExtension => {
  const source = extension as AnyExtension & {
    constructor: new (config: object) => AnyExtension
    config: object
    parent: AnyExtension | null
    name: string
  }
  const fork = new source.constructor({ ...source.config }) as AnyExtension & {
    parent: AnyExtension | null
    name: string
  }
  fork.parent = source.parent
  fork.name = source.name
  return fork
}

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const dayLabel = (ts: number): string => {
  const date = new Date(ts)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (sameDay(date, today)) return 'Today'
  if (sameDay(date, yesterday)) return 'Yesterday'
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

const timeLabel = (ts: number): string =>
  new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

const fullLabel = (ts: number): string => `${dayLabel(ts)}, ${timeLabel(ts)}`

/** Where this version split from, when that is not just the previous checkpoint on a straight line. */
const versionOrigin = (entry: VersionEntry, versions: readonly VersionEntry[]): string | null => {
  if (!entry.parentId) return null
  const parent = versions.find((item) => item.id === entry.parentId)
  if (!parent) return null
  const previous = versions
    .filter((item) => item.id !== entry.id && item.createdAt <= entry.createdAt)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
  const branched = !previous || previous.id !== parent.id
  if (!branched && !parent.label) return null
  return parent.label ?? timeLabel(parent.createdAt)
}

const groupsOf = (versions: readonly VersionEntry[]): { label: string; entries: VersionEntry[] }[] => {
  const groups: { label: string; entries: VersionEntry[] }[] = []
  for (const entry of versions) {
    const label = dayLabel(entry.createdAt)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.entries.push(entry)
    else groups.push({ label, entries: [entry] })
  }
  return groups
}

/** The same editor surface, read-only, so every block renders the way it does on the page. */
function VersionDocument({ source, doc }: { readonly source: Editor; readonly doc: JSONContent }) {
  const extensions = useMemo(() => source.options.extensions.map(forkExtension), [source])
  const preview = useEditor({ extensions, content: doc, editable: false, autofocus: false }, [extensions])

  useEffect(() => {
    if (!preview || preview.isDestroyed) return
    if (JSON.stringify(preview.getJSON()) === JSON.stringify(doc)) return
    preview.commands.setContent(doc, { emitUpdate: false })
  }, [preview, doc])

  return (
    <div className="page-shell">
      <div className="page-layout">
        <main className="page-document">
          <EditorContent editor={preview} />
        </main>
      </div>
    </div>
  )
}

function VersionBubble({
  title,
  description,
  origin,
  when,
  current,
  active,
  onSelect,
  onEdit,
}: {
  readonly title: string
  readonly description?: string
  readonly origin?: string
  readonly when: string
  readonly current: boolean
  readonly active: boolean
  readonly onSelect: () => void
  readonly onEdit: () => void
}) {
  return (
    <div className={`page-versions__item${active ? ' is-active' : ''}`}>
      <button type="button" className="page-versions__item-main" onClick={onSelect}>
        <span className="page-versions__item-title">
          {title}
          {current && <span className="page-versions__badge">Current</span>}
        </span>
        {description && <span className="page-versions__item-desc">{description}</span>}
        {origin && <span className="page-versions__item-meta">from {origin}</span>}
        {when && <span className="page-versions__item-meta">{when}</span>}
      </button>
      <button type="button" className="page-versions__edit" aria-label={`Edit details for ${title}`} onClick={onEdit}>
        <Icon name="pencil" size={14} />
      </button>
    </div>
  )
}

function VersionDetailsDialog({
  title,
  description,
  onTitle,
  onDescription,
  onCancel,
  onSave,
}: {
  readonly title: string
  readonly description: string
  readonly onTitle: (value: string) => void
  readonly onDescription: (value: string) => void
  readonly onCancel: () => void
  readonly onSave: () => void
}) {
  return (
    <div className="page-versions__modal" role="presentation" onMouseDown={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Version details"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          onSave()
        }}
      >
        <h2>Version details</h2>
        <label>
          Title
          <input
            type="text"
            value={title}
            aria-label="Title"
            autoFocus
            onChange={(event) => onTitle(event.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            rows={3}
            aria-label="Description"
            onChange={(event) => onDescription(event.target.value)}
          />
        </label>
        <div className="page-versions__modal-actions">
          <button type="button" className="page-versions__button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="page-versions__restore">
            Save
          </button>
        </div>
      </form>
    </div>
  )
}

/** Version history: the document as it was, with earlier versions listed by date. */
export function VersionsModal({
  editor,
  store,
  close,
}: {
  readonly editor: Editor
  readonly store: VersionStore
  readonly close: () => void
}) {
  const [versions, setVersions] = useState(store.list())
  const [selectedId, setSelectedId] = useState(CURRENT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDescription, setDraftDescription] = useState('')

  useEffect(() => store.subscribe(() => setVersions(store.list())), [store])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (editingId) {
        setEditingId(null)
        return
      }
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, editingId])

  const past = versions.find((entry) => entry.id === selectedId)
  const showingCurrent = !past
  const current = useMemo(() => editor.getJSON(), [editor])
  const live = versions.find((entry) => entry.id === store.currentVersionId())
  const doc = past?.doc ?? current
  const groups = groupsOf(versions)
  const viewed = showingCurrent ? live : past
  const viewedTitle = viewed?.label ?? (showingCurrent ? 'Current version' : fullLabel(past?.createdAt ?? 0))
  const viewedWhen = viewed?.label
    ? fullLabel(viewed.createdAt)
    : showingCurrent
      ? viewed
        ? fullLabel(viewed.createdAt)
        : 'This is the page right now'
      : ''
  const viewingLive = showingCurrent || past?.id === live?.id
  const viewedOrigin = viewed ? versionOrigin(viewed, versions) : null

  const openDetails = (id: string) => {
    const entry = id === CURRENT ? live : versions.find((item) => item.id === id)
    setDraftTitle(entry?.label ?? '')
    setDraftDescription(entry?.description ?? '')
    setEditingId(id)
  }

  const saveDetails = () => {
    if (editingId === CURRENT) {
      if (live) store.updateDetails(live.id, { label: draftTitle, description: draftDescription })
      else if (draftTitle.trim() || draftDescription.trim()) {
        store.snapshot('manual', draftTitle.trim() || undefined, { force: true, description: draftDescription })
      }
    } else if (editingId) {
      store.updateDetails(editingId, { label: draftTitle, description: draftDescription })
    }
    setEditingId(null)
    setVersions(store.list())
  }

  const restore = () => {
    if (!past) return
    store.restoreSaved(past.id)
    close()
  }

  return (
    <div className="page-versions" role="dialog" aria-modal="true" aria-label="Version history">
      <header className="page-versions__header">
        <button type="button" className="page-versions__back" onClick={close} autoFocus>
          <span aria-hidden="true">←</span>
          Version history
        </button>
        <div className="page-versions__when">
          <span className="page-versions__when-title">
            {viewedTitle}
            {viewingLive && viewedTitle !== 'Current version' && <span className="page-versions__badge">Current</span>}
          </span>
          {viewed?.description && <span className="page-versions__when-desc">{viewed.description}</span>}
          {viewedOrigin && <span className="page-versions__when-desc">from {viewedOrigin}</span>}
          {viewedWhen && <span>{viewedWhen}</span>}
        </div>
        <div className="page-versions__header-end">
          {past && (
            <button type="button" className="page-versions__restore" disabled={!editor.isEditable} onClick={restore}>
              Restore this version
            </button>
          )}
        </div>
      </header>
      {store.isPersistenceDegraded() && (
        <p className="page-versions__warning" role="alert">
          Local storage is full. Recent history is kept in memory only and will be lost on reload.
        </p>
      )}
      <div className="page-versions__body">
        <section className="page-versions__preview" aria-label="Document at this version">
          <VersionDocument key={past?.id ?? CURRENT} source={editor} doc={doc} />
        </section>
        <aside className="page-versions__list" aria-label="Versions">
          <VersionBubble
            title={live?.label ?? 'Current version'}
            description={live?.description}
            origin={live ? (versionOrigin(live, versions) ?? undefined) : undefined}
            when={live ? fullLabel(live.createdAt) : 'Not saved as a version yet'}
            current={Boolean(live?.label)}
            active={showingCurrent}
            onSelect={() => setSelectedId(CURRENT)}
            onEdit={() => openDetails(CURRENT)}
          />
          {versions.length === 0 && <p className="page-versions__empty">Earlier versions show up here as you write.</p>}
          {groups.map((group) => (
            <div key={group.label}>
              <p className="page-versions__day">{group.label}</p>
              {group.entries.map((entry) => (
                <VersionBubble
                  key={entry.id}
                  title={entry.label ?? timeLabel(entry.createdAt)}
                  description={entry.description}
                  origin={versionOrigin(entry, versions) ?? undefined}
                  when={entry.label ? fullLabel(entry.createdAt) : ''}
                  current={entry.id === live?.id}
                  active={entry.id === past?.id}
                  onSelect={() => setSelectedId(entry.id)}
                  onEdit={() => openDetails(entry.id)}
                />
              ))}
            </div>
          ))}
        </aside>
      </div>
      {editingId && (
        <VersionDetailsDialog
          title={draftTitle}
          description={draftDescription}
          onTitle={setDraftTitle}
          onDescription={setDraftDescription}
          onCancel={() => setEditingId(null)}
          onSave={saveDetails}
        />
      )}
    </div>
  )
}
