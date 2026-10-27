interface BlockProblemProps {
  readonly title: string
  readonly details?: readonly string[]
}

/** Inline, non-fatal placeholder for unknown types, invalid props, or render errors. */
export function BlockProblem({ title, details = [] }: BlockProblemProps) {
  return (
    <div className="page-block-problem" role="alert">
      <strong>{title}</strong>
      {details.length > 0 && (
        <ul>
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
