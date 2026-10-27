import type { Editor } from '@tiptap/core'
import { useSyncExternalStore } from 'react'
import type { PanelDefinition } from '../plugin/types'
import { Icon, TOOLBAR_ICON } from '../ui/Icon'

export function PanelToggleButton({
  editor,
  panel,
  pressed,
  onToggle,
}: {
  readonly editor: Editor
  readonly panel: PanelDefinition
  readonly pressed: boolean
  readonly onToggle: () => void
}) {
  const badge = panel.badge
  const count = useSyncExternalStore(
    (listener) => (badge ? badge.subscribe(editor, listener) : () => {}),
    () => (badge ? badge.getCount(editor) : 0),
    () => (badge ? badge.getCount(editor) : 0),
  )
  const badgeLabel = count > 99 ? '99+' : String(count)
  return (
    <button
      type="button"
      aria-label={badge && count > 0 ? `${panel.label} (${badgeLabel} open)` : panel.label}
      aria-pressed={pressed}
      className={`page-toolbar__panel-toggle${pressed ? ' is-active' : ''}`}
      onClick={onToggle}
    >
      <span className="page-toolbar__panel-toggle-inner">
        {panel.icon ? <Icon name={panel.icon} {...TOOLBAR_ICON} /> : panel.label}
        {count > 0 && (
          <span className="page-toolbar__badge" aria-hidden="true">
            {badgeLabel}
          </span>
        )}
      </span>
    </button>
  )
}
