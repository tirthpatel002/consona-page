import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_SCALE = 0.35
const MAX_SCALE = 4

interface Transform {
  readonly x: number
  readonly y: number
  readonly scale: number
}

interface PanZoomHandlers {
  readonly onPointerDown: (event: React.PointerEvent) => void
  readonly onPointerMove: (event: React.PointerEvent) => void
  readonly onPointerUp: (event: React.PointerEvent) => void
  readonly onPointerCancel: (event: React.PointerEvent) => void
}

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function pointerMid(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Pan (drag / two-finger scroll) and zoom (pinch / ctrl+wheel) inside the diagram viewport. */
export function useMermaidPanZoom(resetKey: string): {
  readonly viewportRef: React.RefObject<HTMLDivElement | null>
  readonly transform: Transform
  readonly isPanning: boolean
  readonly handlers: PanZoomHandlers
} {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const pinchStartRef = useRef<{
    distance: number
    scale: number
    mid: { x: number; y: number }
    tx: number
    ty: number
  } | null>(null)
  const transformRef = useRef(transform)
  const [seenResetKey, setSeenResetKey] = useState(resetKey)
  if (seenResetKey !== resetKey) {
    setSeenResetKey(resetKey)
    setTransform({ x: 0, y: 0, scale: 1 })
    setIsPanning(false)
  }
  useEffect(() => {
    pointersRef.current.clear()
    panStartRef.current = null
    pinchStartRef.current = null
  }, [resetKey])
  useEffect(() => {
    transformRef.current = transform
  }, [transform])

  const zoomAt = useCallback((clientX: number, clientY: number, nextScale: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const px = clientX - rect.left - rect.width / 2
    const py = clientY - rect.top - rect.height / 2
    setTransform((prev) => {
      const scale = clampScale(nextScale)
      const ratio = scale / prev.scale
      return {
        scale,
        x: prev.x - px * (ratio - 1),
        y: prev.y - py * (ratio - 1),
      }
    })
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      event.stopPropagation()
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (pointersRef.current.size === 1) {
        panStartRef.current = { x: event.clientX, y: event.clientY, tx: transform.x, ty: transform.y }
        setIsPanning(true)
      } else if (pointersRef.current.size === 2) {
        const pts = [...pointersRef.current.values()]
        pinchStartRef.current = {
          distance: pointerDistance(pts[0], pts[1]),
          scale: transform.scale,
          mid: pointerMid(pts[0], pts[1]),
          tx: transform.x,
          ty: transform.y,
        }
        panStartRef.current = null
      }
    },
    [transform.scale, transform.x, transform.y],
  )

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!pointersRef.current.has(event.pointerId)) return
    event.preventDefault()
    event.stopPropagation()
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointersRef.current.size >= 2 && pinchStartRef.current) {
      const pts = [...pointersRef.current.values()]
      const distance = pointerDistance(pts[0], pts[1])
      const mid = pointerMid(pts[0], pts[1])
      const start = pinchStartRef.current
      const nextScale = clampScale(start.scale * (distance / start.distance))
      const ratio = nextScale / start.scale
      const viewport = viewportRef.current
      if (!viewport) return
      const rect = viewport.getBoundingClientRect()
      const px = mid.x - rect.left
      const py = mid.y - rect.top
      const sx = start.mid.x - rect.left
      const sy = start.mid.y - rect.top
      setTransform({
        scale: nextScale,
        x: px - (sx - start.tx) * ratio - (px - sx),
        y: py - (sy - start.ty) * ratio - (py - sy),
      })
      return
    }

    if (pointersRef.current.size === 1 && panStartRef.current) {
      const start = panStartRef.current
      setTransform((prev) => ({
        ...prev,
        x: start.tx + (event.clientX - start.x),
        y: start.ty + (event.clientY - start.y),
      }))
    }
  }, [])

  const releasePointer = useCallback(
    (event: React.PointerEvent) => {
      pointersRef.current.delete(event.pointerId)
      if (pointersRef.current.size < 2) pinchStartRef.current = null
      if (pointersRef.current.size === 0) {
        panStartRef.current = null
        setIsPanning(false)
      } else if (pointersRef.current.size === 1) {
        const remaining = [...pointersRef.current.values()][0]
        panStartRef.current = { x: remaining.x, y: remaining.y, tx: transform.x, ty: transform.y }
      }
    },
    [transform.x, transform.y],
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      releasePointer(event)
    },
    [releasePointer],
  )

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    let safariGesture = false
    let gestureScale = 1

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (safariGesture) return
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * 0.01)
        zoomAt(event.clientX, event.clientY, transformRef.current.scale * factor)
        return
      }
      setTransform((prev) => ({
        ...prev,
        x: prev.x - event.deltaX,
        y: prev.y - event.deltaY,
      }))
    }

    const onGestureStart = (event: Event) => {
      event.preventDefault()
      safariGesture = true
      gestureScale = transformRef.current.scale
    }

    const onGestureChange = (event: Event) => {
      event.preventDefault()
      const gesture = event as Event & { scale: number; clientX: number; clientY: number }
      zoomAt(gesture.clientX, gesture.clientY, gestureScale * gesture.scale)
    }

    const onGestureEnd = (event: Event) => {
      event.preventDefault()
      safariGesture = false
    }

    const overCanvas = (event: Event) => viewport.contains(event.target as Node | null)
    const wheelCapture = (event: WheelEvent) => {
      if (!overCanvas(event)) return
      onWheel(event)
    }
    const gestureStartCapture = (event: Event) => {
      if (!overCanvas(event)) return
      onGestureStart(event)
    }
    const gestureChangeCapture = (event: Event) => {
      if (!overCanvas(event)) return
      onGestureChange(event)
    }
    const gestureEndCapture = (event: Event) => {
      if (!overCanvas(event)) return
      onGestureEnd(event)
    }

    const options: AddEventListenerOptions = { passive: false, capture: true }
    window.addEventListener('wheel', wheelCapture, options)
    document.addEventListener('gesturestart', gestureStartCapture, options)
    document.addEventListener('gesturechange', gestureChangeCapture, options)
    document.addEventListener('gestureend', gestureEndCapture, options)
    return () => {
      window.removeEventListener('wheel', wheelCapture, options)
      document.removeEventListener('gesturestart', gestureStartCapture, options)
      document.removeEventListener('gesturechange', gestureChangeCapture, options)
      document.removeEventListener('gestureend', gestureEndCapture, options)
    }
  }, [zoomAt])

  return {
    viewportRef,
    transform,
    isPanning,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  }
}
