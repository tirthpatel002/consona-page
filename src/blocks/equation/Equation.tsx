import katex from 'katex'
import { useState } from 'react'
import { EditableText } from '../callout/EditableText'

export interface EquationViewProps {
  readonly latex: string
  /** Set when the equation can be edited in place; commits the LaTeX source as one update. Returns false to reject. */
  readonly onEdit?: (next: string) => boolean
}

interface Rendered {
  readonly html?: string
  readonly error?: string
}

function render(latex: string): Rendered {
  try {
    return { html: katex.renderToString(latex, { displayMode: true, throwOnError: true }) }
  } catch (error) {
    return { error: error instanceof Error ? error.message.replace(/^KaTeX parse error: /, '') : 'Invalid equation' }
  }
}

/** Rendered KaTeX by default; click the preview to edit LaTeX source (one field, no duplicate preview). */
export function Equation({ latex, onEdit }: EquationViewProps) {
  const [editing, setEditing] = useState(false)
  if (onEdit && editing) {
    return (
      <div className="page-edit-shell page-equation page-equation--editing">
        <EditableText
          value={latex}
          label="Equation LaTeX"
          className="page-equation__field page-edit-field"
          multiline
          autoFocus
          placeholder="Type LaTeX, e.g. \\frac{a}{b}"
          onFinish={() => setEditing(false)}
          onCommit={(next) => (next === latex ? true : onEdit(next))}
        />
      </div>
    )
  }
  if (onEdit) {
    return (
      <button
        type="button"
        className="page-equation page-equation--interactive page-interactive-target"
        aria-label="Edit equation"
        onClick={() => setEditing(true)}
      >
        <EquationPreview latex={latex} emptyLabel="Click to add equation" />
      </button>
    )
  }
  return <EquationPreview latex={latex} />
}

function EquationPreview({
  latex,
  emptyLabel = 'Empty equation',
}: {
  readonly latex: string
  readonly emptyLabel?: string
}) {
  if (latex.trim() === '') return <div className="page-equation page-equation--empty">{emptyLabel}</div>
  const rendered = render(latex)
  if (rendered.error) {
    return (
      <div className="page-equation page-equation--error" role="alert">
        <code>{latex}</code>
        <small>{rendered.error}</small>
      </div>
    )
  }
  return <div className="page-equation" dangerouslySetInnerHTML={{ __html: rendered.html ?? '' }} />
}
