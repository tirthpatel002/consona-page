import { useCallback, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Icon, TOOLBAR_ICON } from '../ui/Icon'
import { MenuFlyout } from '../ui/MenuFlyout'
import { Popover } from '../ui/Popover'
import type { ToolbarItem } from './types'

export interface ToolbarButtonProps {
  readonly editor: Editor
  readonly item: ToolbarItem
  readonly active: boolean
  readonly enabled: boolean
}

/** Renders one ToolbarItem as a button, opening its popover or flyout when declared. Never steals editor focus. */
export function ToolbarButton({ editor, item, active, enabled }: ToolbarButtonProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const icon = typeof item.icon === 'function' ? item.icon(editor) : item.icon
  const hasFlyout = !!item.flyout
  const hasPopover = !!item.popover

  const getFlyoutAnchor = useCallback(() => buttonRef.current?.getBoundingClientRect() ?? null, [])

  const flyout = item.flyout
  const popover = item.popover
  const flyoutEntries =
    flyout && enabled
      ? flyout({
          editor,
          close: () => setFlyoutOpen(false),
        })
      : []

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title={item.title ?? item.label}
        aria-label={item.title ?? item.label}
        aria-pressed={item.isActive ? active : undefined}
        aria-haspopup={hasFlyout || hasPopover ? 'menu' : undefined}
        aria-expanded={flyoutOpen || !!anchor}
        className={active || flyoutOpen || anchor ? 'is-active' : undefined}
        disabled={!enabled}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => {
          if (hasFlyout && enabled && flyoutEntries.length > 0) setFlyoutOpen(true)
        }}
        onClick={() => {
          if (hasFlyout && enabled) {
            setFlyoutOpen((open) => !open)
            return
          }
          if (hasPopover) setAnchor(anchor ? null : (buttonRef.current?.getBoundingClientRect() ?? null))
          else item.run?.(editor)
        }}
      >
        {icon ? <Icon name={icon} {...TOOLBAR_ICON} /> : item.label}
      </button>
      {hasFlyout && (
        <MenuFlyout
          open={flyoutOpen && flyoutEntries.length > 0}
          getAnchor={getFlyoutAnchor}
          label={item.title ?? item.label}
          entries={flyoutEntries}
          onClose={() => setFlyoutOpen(false)}
          onPointerLeave={() => setFlyoutOpen(false)}
        />
      )}
      {anchor && popover && (
        <Popover anchor={anchor} label={item.title ?? item.label} onClose={() => setAnchor(null)}>
          {popover({ editor, close: () => setAnchor(null) })}
        </Popover>
      )}
    </>
  )
}
