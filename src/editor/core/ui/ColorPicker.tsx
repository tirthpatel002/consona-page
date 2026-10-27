export interface ColorChoice {
  readonly name: string
  /** CSS color, or null for "default / none". */
  readonly value: string | null
}

export interface ColorPickerProps {
  readonly label: string
  readonly colors: readonly ColorChoice[]
  readonly current: string | null
  readonly onPick: (value: string | null) => void
}

/** A grid of swatches; the shared colour picker for text colour, highlight and block colours. */
export function ColorPicker({ label, colors, current, onPick }: ColorPickerProps) {
  return (
    <div className="page-colors" role="group" aria-label={label}>
      {colors.map((color) => (
        <button
          type="button"
          key={color.name}
          title={color.name}
          aria-label={color.name}
          aria-pressed={color.value === current}
          className={`page-colors__swatch${color.value === null ? ' is-none' : ''}${color.value === current ? ' is-active' : ''}`}
          style={color.value ? { background: color.value } : undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(color.value)}
        />
      ))}
    </div>
  )
}
