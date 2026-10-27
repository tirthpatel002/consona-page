import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingPlacement } from './placement'

export interface PopoverProps {
  /** Viewport rectangle to anchor under (e.g. a button's `getBoundingClientRect()`). */
  readonly anchor: DOMRect
  readonly onClose: () => void
  readonly label: string
  readonly children: ReactNode
}

/**
 * Floating panel anchored to a rectangle. Uses the shared space-aware placement: it keeps its default side
 * while it fits, flips only when it must, and shrinks (scrolling) rather than leaving the viewport;
 * closes on Escape or an outside press.
 */
export function Popover({ anchor, onClose, label, children }: PopoverProps) {
  const { ref, placement } = useFloatingPlacement<HTMLDivElement>(anchor)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onPress = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPress, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPress, true)
    }
  }, [onClose, ref])

  return createPortal(
    <div
      ref={ref}
      className="page-popover"
      role="dialog"
      aria-label={label}
      style={{
        left: placement?.left ?? anchor.left,
        top: placement?.top ?? anchor.bottom + 6,
        maxHeight: placement?.maxHeight,
        visibility: placement ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
