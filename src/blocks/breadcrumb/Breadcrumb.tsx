import { useState, type MouseEvent } from 'react'
import { isSafeUrl } from '../../editor/core'
import { EditableText } from '../callout/EditableText'
import { joinLabels, splitLabels, type BreadcrumbItem } from './model'

export interface BreadcrumbViewProps {
  readonly items: readonly BreadcrumbItem[]
  /** Set when the trail can be edited in place; commits " / "-separated labels as one update. */
  readonly onEdit?: (next: readonly BreadcrumbItem[]) => boolean
}

/** Nav trail by default; click to edit labels as " / "-separated text (no duplicate field + trail). */
export function Breadcrumb({ items, onEdit }: BreadcrumbViewProps) {
  const [editing, setEditing] = useState(false)
  if (onEdit && editing) {
    return (
      <nav className="page-edit-shell page-breadcrumb page-breadcrumb--editing" aria-label="Breadcrumb">
        <EditableText
          value={joinLabels(items)}
          label="Breadcrumb items"
          className="page-breadcrumb__field page-edit-field"
          autoFocus
          placeholder="Home / Section / Page"
          onFinish={() => setEditing(false)}
          onCommit={(next) => (next === joinLabels(items) ? true : onEdit(splitLabels(next, items)))}
        />
      </nav>
    )
  }
  return <BreadcrumbTrail items={items} onEditActivate={onEdit && !editing ? () => setEditing(true) : undefined} />
}

function BreadcrumbTrail({
  items,
  onEditActivate,
}: {
  readonly items: readonly BreadcrumbItem[]
  /** Clicking the trail (not a link) opens inline edit. */
  readonly onEditActivate?: () => void
}) {
  const activateEdit = (event: MouseEvent) => {
    if (!onEditActivate) return
    if (event.target instanceof Element && event.target.closest('a.page-breadcrumb__link')) return
    onEditActivate()
  }

  if (items.length === 0) {
    return (
      <nav
        className={[
          'page-breadcrumb',
          'page-breadcrumb--empty',
          onEditActivate && 'page-breadcrumb--interactive page-interactive-target',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="Breadcrumb"
        onClick={onEditActivate ? () => onEditActivate() : undefined}
      >
        Click to add breadcrumb
      </nav>
    )
  }

  return (
    <nav
      className={['page-breadcrumb', onEditActivate && 'page-breadcrumb--interactive page-interactive-target']
        .filter(Boolean)
        .join(' ')}
      aria-label="Breadcrumb"
      onClick={onEditActivate ? activateEdit : undefined}
    >
      <ol>
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <li key={`${index}:${item.label}`}>
              {index > 0 && (
                <span className="page-breadcrumb__separator" aria-hidden="true">
                  ›
                </span>
              )}
              {last || !item.href || !isSafeUrl(item.href) ? (
                <span className="page-breadcrumb__label" aria-current={last ? 'page' : undefined}>
                  {item.label}
                </span>
              ) : (
                <a
                  className="page-breadcrumb__link"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  {item.label}
                </a>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
