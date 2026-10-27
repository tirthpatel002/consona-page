import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icon, lucideStrokeForSize } from '../ui/Icon'
import { isMenuNavKey, moveActiveIndex } from '../menu/menuNavigation'
import { MenuFlyout } from '../ui/MenuFlyout'
import { useFloatingPlacement, type AnchorRect } from '../ui/placement'
import type { BlockMenuItem, BlockMenuSection } from './composeBlockMenu'

interface BlockHandleMenuProps {
  readonly sections: readonly BlockMenuSection[]
  /** Live viewport rect of the handle that opened the menu (re-read on scroll so the menu tracks it). */
  readonly getAnchor: () => AnchorRect | null
  /** `restoreFocus`: hand focus back to the editor (Esc). */
  readonly onClose: (restoreFocus: boolean) => void
  /** Elements whose pointer-downs don't count as "outside" (the handle that toggles the menu). */
  readonly ignore?: () => readonly (Element | null)[]
}

function HandleMenuRow({
  item,
  onClose,
  onSubmenuOpenChange,
  submenuOpen,
}: {
  readonly item: BlockMenuItem
  readonly onClose: (restoreFocus: boolean) => void
  readonly submenuOpen: boolean
  readonly onSubmenuOpenChange: (open: boolean) => void
}) {
  const rowRef = useRef<HTMLButtonElement>(null)
  const hasSubmenu = (item.submenu?.length ?? 0) > 0

  const getRowAnchor = useCallback(() => rowRef.current?.getBoundingClientRect() ?? null, [])

  if (!hasSubmenu) {
    return (
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        data-action={item.id}
        className={item.danger ? 'is-danger' : undefined}
        onClick={() => {
          onClose(false)
          item.select()
        }}
      >
        {item.label}
      </button>
    )
  }

  return (
    <>
      <button
        ref={rowRef}
        type="button"
        role="menuitem"
        tabIndex={-1}
        data-action={item.id}
        className={['has-submenu', submenuOpen && 'is-submenu-open'].filter(Boolean).join(' ') || undefined}
        aria-haspopup="menu"
        aria-expanded={submenuOpen}
        onMouseEnter={() => onSubmenuOpenChange(true)}
        onClick={() => onSubmenuOpenChange(!submenuOpen)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            onSubmenuOpenChange(true)
          }
        }}
      >
        <span>{item.label}</span>
        <Icon name="chevron" size={14} strokeWidth={lucideStrokeForSize(14, 2)} />
      </button>
      <MenuFlyout
        open={submenuOpen}
        getAnchor={getRowAnchor}
        label={item.label}
        entries={(item.submenu ?? []).map((sub) => ({
          id: sub.id,
          label: sub.label,
          danger: sub.danger,
          onSelect: () => {
            onClose(false)
            sub.select()
          },
        }))}
        onClose={() => onSubmenuOpenChange(false)}
        onPointerLeave={() => onSubmenuOpenChange(false)}
      />
    </>
  )
}

/**
 * The block menu opened from the drag handle. Placed with the shared space-aware logic (keeps its side
 * while it fits, flips when it must, scrolls when constrained, never covers the handle or leaves the
 * viewport). Focus moves into it; ↑/↓/Home/End, Enter/Space, Esc, Tab.
 */
export function BlockHandleMenu({ sections, getAnchor, onClose, ignore }: BlockHandleMenuProps) {
  const { ref: rootRef, placement } = useFloatingPlacement<HTMLDivElement>(getAnchor, { minHeight: 140 })
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null)
  const items = () => [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]

  useEffect(() => {
    items()[0]?.focus()
    const onPointerDown = (event: PointerEvent) => {
      const inside = (el: Element | null | undefined) =>
        !!el && event.target instanceof Node && el.contains(event.target)
      const inFlyout = event.target instanceof Element && event.target.closest('.page-menu-flyout')
      if (inFlyout) return
      if (!inside(rootRef.current) && !(ignore?.() ?? []).some(inside)) onClose(false)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, ignore])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { key } = event
    if (isMenuNavKey(key)) {
      setOpenSubmenuId(null)
      const list = items()
      const current = list.indexOf(document.activeElement as HTMLButtonElement)
      list[
        moveActiveIndex(
          list.map(() => true),
          current,
          key,
        )
      ]?.focus()
    } else if (key === 'Enter' || key === ' ') {
      const current = document.activeElement
      if (current instanceof HTMLButtonElement && rootRef.current?.contains(current)) current.click()
    } else if (key === 'Escape') {
      if (openSubmenuId) {
        setOpenSubmenuId(null)
      } else {
        onClose(true)
      }
    } else if (key === 'Tab') {
      onClose(false)
      return
    } else {
      return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div
      className="page-handle-menu"
      role="menu"
      aria-label="Block actions"
      ref={rootRef}
      style={{
        left: placement?.left ?? 0,
        top: placement?.top ?? 0,
        maxHeight: placement?.maxHeight,
        visibility: placement ? 'visible' : 'hidden',
      }}
      onKeyDown={onKeyDown}
      onMouseLeave={() => setOpenSubmenuId(null)}
    >
      {sections.map((section) => (
        <div className="page-handle-menu__section" role="group" aria-label={section.label} key={section.id}>
          {section.label && (
            <div className="page-handle-menu__label" aria-hidden="true">
              {section.label}
            </div>
          )}
          {section.items.map((item) => (
            <HandleMenuRow
              key={item.id}
              item={item}
              onClose={onClose}
              submenuOpen={openSubmenuId === item.id}
              onSubmenuOpenChange={(open) => setOpenSubmenuId(open ? item.id : null)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
