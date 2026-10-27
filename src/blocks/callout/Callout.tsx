import { useRef } from 'react'
import { EditableText, type EditableTextHandle } from './EditableText'
import type { CalloutVariant } from './model'

const ICONS: Record<CalloutVariant, string> = {
  info: 'i',
  success: '✓',
  warning: '!',
  danger: '×',
  neutral: '•',
}

export interface CalloutViewProps {
  readonly variant: CalloutVariant
  readonly title?: string
  readonly body: string
  /** Set when the callout can be edited in place; each field commits as one update. Returns false to reject. */
  readonly onEdit?: (field: 'title' | 'body', next: string) => boolean
}

/** A plain React component: no editor knowledge. The block binding in index.tsx feeds it validated props. */
export function Callout({ variant, title, body, onEdit }: CalloutViewProps) {
  const bodyRef = useRef<EditableTextHandle>(null)

  return (
    <div className={`page-callout page-block__shell page-callout--${variant}`} role="note">
      <span className="page-callout__icon" aria-hidden="true">
        {ICONS[variant]}
      </span>
      <div className="page-callout__content">
        {onEdit ? (
          <>
            <div className="page-callout__title">
              <EditableText
                value={title ?? ''}
                label="Callout title"
                className="page-callout__field page-inset-field"
                placeholder="Title (optional)"
                multiline
                enterBehavior="focusNext"
                focusNextRef={bodyRef}
                onCommit={(next) => onEdit('title', next)}
              />
            </div>
            <div className="page-callout__body">
              <EditableText
                ref={bodyRef}
                value={body}
                label="Callout text"
                className="page-callout__field page-inset-field"
                multiline
                placeholder="Write something…"
                onCommit={(next) => onEdit('body', next)}
              />
            </div>
          </>
        ) : (
          <>
            {title ? <div className="page-callout__title">{title}</div> : null}
            <div className="page-callout__body">{body}</div>
          </>
        )}
      </div>
    </div>
  )
}
