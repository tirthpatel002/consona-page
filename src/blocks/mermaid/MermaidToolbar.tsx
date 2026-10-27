import type { ReactNode } from 'react'
import { useState } from 'react'
import { Icon, lucideStrokeForSize } from '../../editor/core'
import { copyMermaidSource } from './copySource'
import type { MermaidModalView } from './MermaidModal'

const ICON = { size: 15, strokeWidth: lucideStrokeForSize(15, 2) } as const

/** One rounded tab: every action is the same size and shares one alignment. */
export function MermaidActionBar({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="page-mermaid-toolbar" role="toolbar" aria-label={label} data-block-ui="">
      {children}
    </div>
  )
}

export function MermaidViewToggle({
  view,
  onViewChange,
}: {
  readonly view: MermaidModalView
  readonly onViewChange: (view: MermaidModalView) => void
}) {
  return (
    <>
      <button
        type="button"
        className={view === 'diagram' ? 'is-active' : undefined}
        aria-pressed={view === 'diagram'}
        title="Preview"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => onViewChange('diagram')}
      >
        <Icon name="eye" {...ICON} />
      </button>
      <button
        type="button"
        className={view === 'source' ? 'is-active' : undefined}
        aria-pressed={view === 'source'}
        title="Source"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => onViewChange('source')}
      >
        <Icon name="braces" {...ICON} />
      </button>
    </>
  )
}

export function MermaidCopyButton({ source }: { readonly source: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      className="page-mermaid-block__copy"
      title={copied ? 'Copied' : 'Copy source'}
      aria-label={copied ? 'Copied' : 'Copy diagram source'}
      data-block-ui=""
      onMouseDown={(event) => event.stopPropagation()}
      onClick={async () => {
        const ok = await copyMermaidSource(source)
        if (!ok) return
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} {...ICON} />
    </button>
  )
}
