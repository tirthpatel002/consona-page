import { useState } from 'react'
import { Icon, lucideStrokeForSize } from '../../editor/core'
import { EditableText } from '../callout/EditableText'
import { addTab, type TabItem } from './model'

export interface TabsViewProps {
  readonly tabs: readonly TabItem[]
  /** Set when the tabs can be edited; receives the whole tab list as one update. Returns false to reject. */
  readonly onEdit?: (next: readonly TabItem[]) => boolean
}

/** A plain React component: tab headers switch the visible body; titles and body edit inline when editable. */
export function Tabs({ tabs, onEdit }: TabsViewProps) {
  const [activeId, setActiveId] = useState<string | undefined>(tabs[0]?.id)
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]
  if (!active) return <div className="page-tabs page-block__shell page-tabs--empty">Empty tabs</div>

  const patch = (next: TabItem[]) => onEdit?.(next) ?? false

  return (
    <div className="page-tabs page-block__shell">
      <div className="page-tabs__headers" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === active.id
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              className={`page-tabs__header${isActive ? ' is-active' : ''}`}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.target === event.currentTarget) setActiveId(tab.id)
              }}
            >
              {onEdit ? (
                <EditableText
                  value={tab.title}
                  label={`Title of tab ${tab.title}`}
                  className="page-tabs__title"
                  onCommit={(next) =>
                    next !== '' && patch(tabs.map((t) => (t.id === tab.id ? { ...t, title: next } : t)))
                  }
                />
              ) : (
                <span className="page-tabs__title">{tab.title}</span>
              )}
              {onEdit && tabs.length > 1 && (
                <button
                  type="button"
                  className="page-tabs__remove"
                  aria-label={`Remove tab ${tab.title}`}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    patch(tabs.filter((t) => t.id !== tab.id))
                  }}
                >
                  <Icon name="close" size={14} strokeWidth={lucideStrokeForSize(14, 2)} />
                </button>
              )}
            </div>
          )
        })}
        {onEdit && (
          <div className="page-tabs__add-slot">
            <button
              type="button"
              className="page-tabs__add"
              aria-label="Add tab"
              onClick={() => {
                const next = addTab(tabs)
                if (patch(next)) setActiveId(next[next.length - 1]?.id)
              }}
            >
              <Icon name="plus" size={14} strokeWidth={lucideStrokeForSize(14, 2)} />
            </button>
          </div>
        )}
      </div>
      <div className="page-tabs__body" role="tabpanel" key={active.id}>
        {onEdit ? (
          <EditableText
            value={active.body}
            label={`Content of tab ${active.title}`}
            className="page-tabs__content"
            multiline
            placeholder="Write something…"
            onCommit={(next) => patch(tabs.map((t) => (t.id === active.id ? { ...t, body: next } : t)))}
          />
        ) : (
          <span className="page-tabs__content">{active.body}</span>
        )}
      </div>
    </div>
  )
}
