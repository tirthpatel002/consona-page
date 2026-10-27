import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** Viewport-space rectangle the floating element is anchored to (trigger button, caret, block edge). */
export interface AnchorRect {
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly right: number
}

export interface PlacementOptions {
  readonly gap?: number
  /** Clearance kept from every viewport edge. */
  readonly margin?: number
  /** Preferred side of the anchor; used whenever the element fits there. */
  readonly prefer?: 'bottom' | 'top'
  /** Smallest height the floating element stays usable at (drives the flip decision). */
  readonly minHeight?: number
  /** Horizontal alignment against the anchor: its left edge (default), its centre, or its right edge. */
  readonly align?: 'start' | 'center' | 'end'
}

export interface FloatingPlacement {
  readonly left: number
  readonly top: number
  /** Available height on the chosen side; the floating element must not exceed it (scroll instead). */
  readonly maxHeight: number
  readonly side: 'bottom' | 'top'
}

export interface FlyoutPlacementOptions {
  readonly gap?: number
  readonly margin?: number
  readonly minHeight?: number
  /** Prefer opening beside the anchor (over the parent menu) before above/below. */
  readonly preferHorizontal?: 'right' | 'left'
}

export interface FlyoutPlacement {
  readonly left: number
  readonly top: number
  readonly maxHeight: number
  readonly side: 'right' | 'left' | 'bottom' | 'top'
}

/**
 * Submenu flyout: prefers right/left of the anchor (overlaying the parent menu), then below/above if
 * horizontal space is too tight. Vertically aligns to the anchor top, clamped inside the viewport.
 */
export function placeFlyout(
  anchor: AnchorRect,
  floating: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
  options: FlyoutPlacementOptions = {},
): FlyoutPlacement {
  const gap = options.gap ?? 4
  const margin = options.margin ?? 8
  const minHeight = options.minHeight ?? 80
  const preferH = options.preferHorizontal ?? 'right'

  const spaceRight = viewport.width - anchor.right - gap - margin
  const spaceLeft = anchor.left - gap - margin
  const spaceBottom = viewport.height - anchor.bottom - gap - margin
  const spaceTop = anchor.top - gap - margin

  const fitsRight = floating.width <= spaceRight
  const fitsLeft = floating.width <= spaceLeft
  const fitsBottom = floating.height <= spaceBottom

  let side: FlyoutPlacement['side']
  let left: number
  let top: number

  const tryRightFirst = preferH === 'right'
  if (tryRightFirst ? fitsRight || spaceRight >= spaceLeft : fitsLeft || spaceLeft >= spaceRight) {
    side = tryRightFirst && (fitsRight || spaceRight >= spaceLeft) ? 'right' : 'left'
  } else if (fitsBottom || spaceBottom >= spaceTop) {
    side = 'bottom'
  } else {
    side = 'top'
  }
  if ((side === 'right' && !fitsRight && floating.width > spaceRight) || (side === 'left' && !fitsLeft)) {
    side = fitsBottom || spaceBottom >= spaceTop ? 'bottom' : 'top'
  }

  if (side === 'right') {
    left = anchor.right + gap
    top = anchor.top
  } else if (side === 'left') {
    left = anchor.left - gap - floating.width
    top = anchor.top
  } else if (side === 'bottom') {
    left = anchor.left
    top = anchor.bottom + gap
  } else {
    left = anchor.left
    top = anchor.top - gap - floating.height
  }

  const maxLeft = Math.max(margin, viewport.width - floating.width - margin)
  left = Math.max(margin, Math.min(left, maxLeft))

  const maxHeight =
    side === 'right' || side === 'left'
      ? Math.max(0, viewport.height - margin * 2)
      : side === 'bottom'
        ? Math.max(0, viewport.height - top - margin)
        : Math.max(0, top - margin)

  const height = Math.min(floating.height, Math.max(minHeight, maxHeight))
  if (side === 'top') top = Math.max(margin, top)
  if (side === 'right' || side === 'left') {
    top = Math.max(margin, Math.min(top, viewport.height - height - margin))
  }

  return { left, top, maxHeight: Math.max(minHeight, maxHeight), side }
}

const DEFAULT_GAP = 6
const DEFAULT_MARGIN = 8
const DEFAULT_MIN_HEIGHT = 120

/**
 * Space-aware placement for menus and popovers. The preferred side wins while the element fits there;
 * it flips only when the other side fits better, and otherwise clamps to the roomier side with an
 * adaptive max height (the caller scrolls its contents). Horizontally it stays inside the viewport.
 */
export function placeFloating(
  anchor: AnchorRect,
  floating: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
  options: PlacementOptions = {},
): FloatingPlacement {
  const gap = options.gap ?? DEFAULT_GAP
  const margin = options.margin ?? DEFAULT_MARGIN
  const prefer = options.prefer ?? 'bottom'
  const minHeight = options.minHeight ?? DEFAULT_MIN_HEIGHT

  const space: Record<'bottom' | 'top', number> = {
    bottom: viewport.height - anchor.bottom - gap - margin,
    top: anchor.top - gap - margin,
  }
  const other = prefer === 'bottom' ? 'top' : 'bottom'
  let side: 'bottom' | 'top'
  if (floating.height <= space[prefer]) side = prefer
  else if (floating.height <= space[other]) side = other
  // Fits neither side fully: use the roomier one, but never flip for a marginal gain.
  else if (space[prefer] >= Math.min(minHeight, space[other])) side = prefer
  else side = other

  const maxHeight = Math.max(0, space[side])
  const height = Math.min(floating.height, maxHeight)
  const top = side === 'bottom' ? anchor.bottom + gap : anchor.top - gap - height

  const wantedLeft =
    options.align === 'center'
      ? (anchor.left + anchor.right) / 2 - floating.width / 2
      : options.align === 'end'
        ? anchor.right - floating.width
        : anchor.left
  const maxLeft = Math.max(margin, viewport.width - floating.width - margin)
  const left = Math.max(margin, Math.min(wantedLeft, maxLeft))
  return { left, top, maxHeight, side }
}

/**
 * Measures a floating element and keeps it placed against `anchor`: a static viewport rect, or a getter that
 * re-reads a live one (a trigger button's rect) so the element tracks its anchor through scrolling.
 * Re-runs on anchor changes, resize and scroll. Until measured, `placement` is null: render with
 * `visibility: hidden` so it never flashes misplaced.
 */
export function useFloatingPlacement<T extends HTMLElement>(
  anchor: AnchorRect | null | (() => AnchorRect | null),
  options: PlacementOptions = {},
): { readonly ref: RefObject<T | null>; readonly placement: FloatingPlacement | null } {
  const ref = useRef<T>(null)
  const [placement, setPlacement] = useState<FloatingPlacement | null>(null)
  const { gap, margin, prefer, minHeight, align } = options

  // Getter anchors compare by identity (consumers memoize them); rect anchors by value.
  const getterAnchor = typeof anchor === 'function' ? anchor : null
  const rectTop = typeof anchor === 'function' ? null : anchor?.top
  const rectBottom = typeof anchor === 'function' ? null : anchor?.bottom
  const rectLeft = typeof anchor === 'function' ? null : anchor?.left
  const rectRight = typeof anchor === 'function' ? null : anchor?.right

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !anchor) return
    const update = () => {
      const rect = typeof anchor === 'function' ? anchor() : anchor
      if (!rect) {
        setPlacement(null)
        return
      }
      setPlacement(
        placeFloating(
          rect,
          { width: el.offsetWidth, height: el.offsetHeight },
          { width: window.innerWidth, height: window.innerHeight },
          { gap, margin, prefer, minHeight, align },
        ),
      )
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
    // Getter anchors are compared by identity (memoize them); rect anchors by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getterAnchor, rectTop, rectBottom, rectLeft, rectRight, gap, margin, prefer, minHeight, align])

  return { ref, placement }
}
