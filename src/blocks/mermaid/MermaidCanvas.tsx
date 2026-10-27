import { useEffect, useState } from 'react'
import mermaid from 'mermaid'
import { MermaidPanZoomCanvas } from './MermaidPanZoomCanvas'
import { applyMermaidPageTheme } from './mermaidTheme'

let renderCounter = 0

interface Rendered {
  readonly svg?: string
  readonly error?: string
}

function useDiagram(source: string): Rendered | null {
  const [rendered, setRendered] = useState<{ readonly source: string; readonly result: Rendered } | null>(null)
  useEffect(() => {
    if (source.trim() === '') return
    let stale = false
    applyMermaidPageTheme()
    renderCounter += 1
    mermaid
      .render(`page-mermaid-${renderCounter}`, source)
      .then(({ svg }) => {
        if (!stale) setRendered({ source, result: { svg } })
      })
      .catch((error: unknown) => {
        if (!stale)
          setRendered({ source, result: { error: error instanceof Error ? error.message : 'Invalid diagram' } })
      })
    return () => {
      stale = true
    }
  }, [source])
  return rendered && rendered.source === source ? rendered.result : null
}

export function MermaidCanvas({
  source,
  variant = 'embed',
  onFrameHeight,
}: {
  readonly source: string
  readonly variant?: 'embed' | 'modal'
  /** Embed frame height: full diagram, never above 500px. */
  readonly onFrameHeight?: (height: number) => void
}) {
  const rendered = useDiagram(source)
  const className = ['page-mermaid-canvas', variant === 'modal' && 'page-mermaid-canvas--modal']
    .filter(Boolean)
    .join(' ')

  if (source.trim() === '') {
    return <div className={`${className} page-mermaid-canvas--empty`}>Add diagram source to preview.</div>
  }
  if (rendered?.error) {
    return (
      <div className={`${className} page-mermaid-canvas--error`} role="alert">
        <p>{rendered.error}</p>
        <pre>{source}</pre>
      </div>
    )
  }
  if (!rendered?.svg) {
    return <div className={`${className} page-mermaid-canvas--loading`}>Rendering diagram…</div>
  }
  return (
    <MermaidPanZoomCanvas
      resetKey={source}
      className={className}
      onFrameHeight={variant === 'embed' ? onFrameHeight : undefined}
    >
      <div className="page-mermaid-viewport__diagram" dangerouslySetInnerHTML={{ __html: rendered.svg }} />
    </MermaidPanZoomCanvas>
  )
}
