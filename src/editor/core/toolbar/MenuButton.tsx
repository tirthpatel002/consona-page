import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { isMenuNavKey, moveActiveIndex } from '../menu/menuNavigation'
import { useFloatingPlacement, type AnchorRect } from '../ui/placement'
import { Icon, lucideStrokeForSize } from '../ui/Icon'
import type { BlockToolbarAction, BlockToolbarMenu } from './blockToolbarDefinition'

export interface MenuButtonProps {
  readonly menu: BlockToolbarMenu
  readonly enabled: Readonly<Record<string, boolean>>
  readonly open: boolean
  /** Viewport point (right/bottom of the opener) to show the popup at instead of under the button. */
  readonly at?: { readonly x: number; readonly y: number }
  readonly onOpenChange: (open: boolean) => void
  readonly onChoose: (action: BlockToolbarAction) => void
  /** Presses on these elements never close the menu. */
  readonly isMenuOpener?: (target: Element) => boolean
}

/**
 * Toolbar button + vertical menu. Editor focus is never taken (the toolbar prevents mousedown
 * default), so while open the menu handles keys in the capture phase before ProseMirror:
 * ↑/↓/Home/End move, Enter/Space choose, Esc/Tab close. Outside mousedown or scrolling closes.
 */
export function MenuButton({ menu, enabled, open, at, onOpenChange, onChoose, isMenuOpener }: MenuButtonProps) {
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const baseId = useId()
  const items = useMemo(() => menu.sections.flat(), [menu])
  const sections = useMemo(() => {
    let next = 0
    return menu.sections.map((section) => section.map((item) => ({ item, i: next++ })))
  }, [menu])
  const flags = useMemo(() => items.map((item) => enabled[item.id] ?? false), [items, enabled])

  useEffect(() => {
    if (!open) return
    const choose = (index: number) => {
      const item = items[index]
      if (!item || !flags[index]) return
      onOpenChange(false)
      onChoose(item)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const { key } = event
      if (isMenuNavKey(key)) {
        setActive((current) => moveActiveIndex(flags, current, key))
      } else if (key === 'Enter' || key === ' ') {
        if (active >= 0) choose(active)
        else setActive(moveActiveIndex(flags, -1, 'ArrowDown'))
      } else if (key === 'Escape' || key === 'Tab') {
        onOpenChange(false)
        if (key === 'Tab') return
      } else {
        return
      }
      event.preventDefault()
      event.stopPropagation()
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return onOpenChange(false)
      if (rootRef.current?.contains(target) || isMenuOpener?.(target)) return
      onOpenChange(false)
    }
    const onScroll = () => {
      if (at) onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('mousedown', onPointerDown, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('mousedown', onPointerDown, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, active, items, flags, at, onOpenChange, onChoose, isMenuOpener])

  const toggle = () => {
    setActive(-1)
    onOpenChange(!open)
  }
  const menuId = `${baseId}-menu`
  // Space-aware placement: under the opener while it fits, flipping/constraining only when it must (A3).
  // The opener's rect is read live so the menu tracks it through scrolling.
  const getButtonRect = useCallback(() => buttonRef.current?.getBoundingClientRect() ?? null, [])
  const atAnchor: AnchorRect | null = at ? { top: at.y - 2, bottom: at.y + 2, left: at.x, right: at.x } : null
  const { ref: popupRef, placement } = useFloatingPlacement<HTMLDivElement>(
    !open ? null : at ? atAnchor : getButtonRect,
    {
      prefer: 'bottom',
      align: at ? 'end' : 'start',
      minHeight: 120,
    },
  )

  return (
    <div className="page-block-menu" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        data-menu={menu.id}
        title={menu.title}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={open ? 'is-open' : undefined}
        disabled={!flags.includes(true)}
        onClick={toggle}
        onKeyDown={(event) => {
          if (!open && event.key === 'ArrowDown') {
            event.preventDefault()
            onOpenChange(true)
            setActive(moveActiveIndex(flags, -1, 'ArrowDown'))
          }
        }}
      >
        <span>{menu.label}</span>
        <Icon name="chevron" size={14} strokeWidth={lucideStrokeForSize(14, 2)} />
      </button>
      {open && (
        <div
          className="page-block-menu__popup"
          role="menu"
          id={menuId}
          ref={popupRef}
          style={{
            left: placement?.left ?? (at ? at.x : 0),
            top: placement?.top ?? (at ? at.y + 4 : 0),
            maxHeight: placement?.maxHeight,
            visibility: placement ? 'visible' : 'hidden',
          }}
          aria-label={menu.title}
          aria-activedescendant={active >= 0 ? `${baseId}-item-${active}` : undefined}
        >
          {sections.map((section, sectionIndex) => (
            <div className="page-block-menu__section" role="group" key={section[0]?.item.id ?? sectionIndex}>
              {section.map(({ item, i }) => (
                <button
                  key={item.id}
                  id={`${baseId}-item-${i}`}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  data-action={item.id}
                  title={item.title}
                  disabled={!flags[i]}
                  aria-disabled={!flags[i]}
                  className={
                    [item.danger && 'is-danger', i === active && 'is-active'].filter(Boolean).join(' ') || undefined
                  }
                  onMouseEnter={() => setActive(flags[i] ? i : -1)}
                  onClick={() => {
                    onOpenChange(false)
                    onChoose(item)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
