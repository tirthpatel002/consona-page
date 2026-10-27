import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon, lucideStrokeForSize } from '../../editor/core'
import { MermaidCanvas } from './MermaidCanvas'
import { MermaidSourcePanel } from './MermaidSourcePanel'
import { MermaidActionBar, MermaidCopyButton, MermaidViewToggle } from './MermaidToolbar'

export type MermaidModalView = 'diagram' | 'source'

export interface MermaidModalProps {
  readonly source: string
  readonly view: MermaidModalView
  readonly onViewChange: (view: MermaidModalView) => void
  readonly onClose: () => void
  readonly onEdit?: (next: string) => boolean
}

/** Full-screen diagram studio: canvas or source, with the same view toggles as the embed. */
export function MermaidModal({ source, view, onViewChange, onClose, onEdit }: MermaidModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return createPortal(
    <div className="page-mermaid-modal" role="presentation">
      <button type="button" className="page-mermaid-modal__backdrop" aria-label="Close diagram" onClick={onClose} />
      <div className="page-mermaid-modal__panel" role="dialog" aria-modal="true" aria-label="Mermaid diagram">
        <header className="page-mermaid-modal__header">
          <span className="page-mermaid-modal__title">Diagram</span>
          <MermaidActionBar label="Diagram actions">
            <MermaidViewToggle view={view} onViewChange={onViewChange} />
            <MermaidCopyButton source={source} />
            <button ref={closeRef} type="button" title="Close" aria-label="Close" onClick={onClose}>
              <Icon name="close" size={15} strokeWidth={lucideStrokeForSize(15, 2)} />
            </button>
          </MermaidActionBar>
        </header>
        <div className="page-mermaid-modal__body">
          {view === 'diagram' ? (
            <MermaidCanvas source={source} variant="modal" />
          ) : (
            <MermaidSourcePanel source={source} variant="modal" onEdit={onEdit} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
