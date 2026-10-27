import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useMermaidPanZoom } from './useMermaidPanZoom'

/** Pan with translate only. Zoom by resizing the SVG so it stays a vector, not a stretched bitmap. */
const EMBED_MAX_HEIGHT = 500
const EMBED_CHROME = 60

export function MermaidPanZoomCanvas({
  resetKey,
  className,
  onFrameHeight,
  children,
}: {
  readonly resetKey: string
  readonly className: string
  readonly onFrameHeight?: (height: number) => void
  readonly children: ReactNode
}) {
  const { viewportRef, transform, isPanning, handlers } = useMermaidPanZoom(resetKey)
  const contentRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const svg = contentRef.current?.querySelector('svg')
    if (!svg) return
    const box = svg.viewBox.baseVal
    let width = box.width
    let height = box.height
    if (width <= 0 || height <= 0) {
      try {
        const bounds = svg.getBBox()
        width = bounds.width
        height = bounds.height
      } catch {
        return
      }
    }
    if (width <= 0 || height <= 0) return
    svg.style.width = `${width * transform.scale}px`
    svg.style.height = `${height * transform.scale}px`
    onFrameHeight?.(Math.min(Math.ceil(height + EMBED_CHROME), EMBED_MAX_HEIGHT))
  }, [onFrameHeight, resetKey, transform.scale])

  return (
    <div
      ref={viewportRef}
      className={`${className} page-mermaid-canvas--panzoom${isPanning ? ' is-panning' : ''}`}
      data-block-ui=""
      {...handlers}
    >
      <div
        ref={contentRef}
        className="page-mermaid-viewport__content"
        style={{
          transform: `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px))`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
