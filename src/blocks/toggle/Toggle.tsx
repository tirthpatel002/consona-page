import { useEffect, useRef, useState } from 'react'
import { Icon, lucideStrokeForSize } from '../../editor/core'
import { EditableText, type EditableTextHandle } from '../callout/EditableText'
import type { ToggleProps } from './model'

export interface ToggleViewProps extends ToggleProps {
  readonly onEdit?: {
    readonly toggleOpen: () => void
    readonly setTitle: (next: string) => boolean
    readonly setBody: (next: string) => boolean
  }
}

export function Toggle({ open, level, title, body, onEdit }: ToggleViewProps) {
  const [readOpen, setReadOpen] = useState(open)
  const [seenOpen, setSeenOpen] = useState(open)
  if (!onEdit && seenOpen !== open) {
    setSeenOpen(open)
    setReadOpen(open)
  }
  const isOpen = onEdit ? open : readOpen
  const toggleOpen = () => {
    if (onEdit) onEdit.toggleOpen()
    else setReadOpen((value) => !value)
  }
  const titleRowClass = level
    ? `page-toggle-embed__title-row page-toggle-embed__title-row--h${level}`
    : 'page-toggle-embed__title-row'
  const bodyRef = useRef<EditableTextHandle>(null)
  const focusBodyAfterOpen = useRef(false)

  useEffect(() => {
    if (!open || !focusBodyAfterOpen.current) return
    focusBodyAfterOpen.current = false
    bodyRef.current?.focus('start')
  }, [open])

  return (
    <div className="page-toggle-embed">
      <div className={titleRowClass}>
        <button
          type="button"
          className={`page-toggle-embed__chevron${isOpen ? ' is-open' : ''}`}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Collapse section' : 'Expand section'}
          onClick={toggleOpen}
        >
          <Icon name="chevron-right" size={20} strokeWidth={lucideStrokeForSize(20, 2)} />
        </button>
        {onEdit ? (
          <EditableText
            value={title}
            label="Toggle title"
            className="page-toggle-embed__title"
            placeholder="Toggle"
            multiline
            enterBehavior="focusNext"
            focusNextRef={bodyRef}
            onEnterFocusNext={() => {
              if (!open) {
                focusBodyAfterOpen.current = true
                onEdit.toggleOpen()
              }
            }}
            onCommit={(next) => onEdit.setTitle(next)}
          />
        ) : (
          <span className="page-toggle-embed__title">{title || 'Toggle'}</span>
        )}
      </div>
      {isOpen &&
        (onEdit ? (
          <EditableText
            ref={bodyRef}
            value={body}
            label="Toggle body"
            className="page-toggle-embed__body"
            multiline
            placeholder="Add content…"
            onCommit={(next) => onEdit.setBody(next)}
          />
        ) : (
          <div className="page-toggle-embed__body page-toggle-embed__body--static">{body}</div>
        ))}
    </div>
  )
}
