import { useState } from 'react'
import { Icon, lucideStrokeForSize } from '../../editor/core'
import { MermaidCanvas } from './MermaidCanvas'
import { MermaidModal, type MermaidModalView } from './MermaidModal'
import { MermaidSourcePanel } from './MermaidSourcePanel'
import { MermaidActionBar, MermaidCopyButton, MermaidViewToggle } from './MermaidToolbar'

export interface MermaidViewProps {
  readonly source: string
  /** Set when the diagram can be edited in place; commits the source as one update. Returns false to reject. */
  readonly onEdit?: (next: string) => boolean
}

/** Preview-first Mermaid block: themed canvas, toolbar, source in a scroll panel, expand to modal. */
export function Mermaid({ source, onEdit }: MermaidViewProps) {
  const [view, setView] = useState<MermaidModalView>('diagram')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalView, setModalView] = useState<MermaidModalView>('diagram')
  const [frameHeight, setFrameHeight] = useState<number | null>(null)

  const openModal = () => {
    setModalView('diagram')
    setModalOpen(true)
  }

  const showSource = view === 'source'

  return (
    <div className="page-mermaid-block">
      <div
        className="page-mermaid-block__stage"
        style={frameHeight ? { height: frameHeight, minHeight: frameHeight } : undefined}
      >
        <MermaidActionBar label="Diagram actions">
          <button
            type="button"
            className="page-mermaid-block__expand"
            title="Open in canvas"
            aria-label="Open diagram in canvas"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={openModal}
          >
            <Icon name="expand" size={15} strokeWidth={lucideStrokeForSize(15, 2)} />
          </button>
          <MermaidViewToggle view={view} onViewChange={setView} />
          <MermaidCopyButton source={source} />
        </MermaidActionBar>
        {showSource ? (
          <MermaidSourcePanel source={source} variant="embed" onEdit={onEdit} />
        ) : (
          <MermaidCanvas source={source} variant="embed" onFrameHeight={setFrameHeight} />
        )}
      </div>
      {modalOpen && (
        <MermaidModal
          source={source}
          view={modalView}
          onViewChange={setModalView}
          onClose={() => setModalOpen(false)}
          onEdit={onEdit}
        />
      )}
    </div>
  )
}
