import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { placeFlyout, type AnchorRect } from './placement'

export interface MenuFlyoutEntry {
  readonly id: string
  readonly label: ReactNode
  readonly danger?: boolean
  readonly onSelect: () => void
}

export interface MenuFlyoutProps {
  readonly open: boolean
  readonly getAnchor: () => AnchorRect | null
  readonly label: string
  readonly entries: readonly MenuFlyoutEntry[]
  readonly onClose: () => void
  /** Keep open while pointer moves between trigger and panel. */
  readonly onPointerLeave?: () => void
}

/** Space-aware submenu panel (left/right/top/bottom), rendered above the parent menu. */
export function MenuFlyout({ open, getAnchor, label, entries, onClose, onPointerLeave }: MenuFlyoutProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<{ left: number; top: number; maxHeight: number } | null>(null)

  const measure = useCallback(() => {
    const el = ref.current
    const anchor = getAnchor()
    if (!el || !anchor || !open) {
      setStyle(null)
      return
    }
    const placement = placeFlyout(
      anchor,
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    )
    setStyle({ left: placement.left, top: placement.top, maxHeight: placement.maxHeight })
  }, [getAnchor, open])

  useLayoutEffect(() => {
    if (!open) return
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, measure, entries.length])

  if (!open) return null

  return createPortal(
    <div
      ref={ref}
      className="page-menu-flyout"
      role="menu"
      aria-label={label}
      style={{
        left: style?.left ?? 0,
        top: style?.top ?? 0,
        maxHeight: style?.maxHeight,
        visibility: style ? 'visible' : 'hidden',
      }}
      onMouseLeave={onPointerLeave}
    >
      {entries.map((entry) => (
        <button
          type="button"
          role="menuitem"
          key={entry.id}
          className={entry.danger ? 'is-danger' : undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            entry.onSelect()
            onClose()
          }}
        >
          {entry.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}
