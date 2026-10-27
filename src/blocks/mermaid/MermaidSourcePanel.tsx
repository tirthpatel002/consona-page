import { EditableText } from '../callout/EditableText'

export interface MermaidSourcePanelProps {
  readonly source: string
  readonly variant?: 'embed' | 'modal'
  readonly onEdit?: (next: string) => boolean
}

/** Bounded scroll area (x + y) for Mermaid source — replaces the canvas when source view is active. */
export function MermaidSourcePanel({ source, variant = 'embed', onEdit }: MermaidSourcePanelProps) {
  const className = ['page-mermaid-source-panel', variant === 'modal' && 'page-mermaid-source-panel--modal']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      {onEdit ? (
        <EditableText
          value={source}
          label="Diagram Mermaid source"
          className="page-mermaid-source-panel__field page-inset-field"
          multiline
          autoFocus={variant === 'modal'}
          placeholder={'flowchart LR\n  A --> B'}
          onCommit={onEdit}
        />
      ) : (
        <pre className="page-mermaid-source-panel__readonly">{source}</pre>
      )}
    </div>
  )
}
