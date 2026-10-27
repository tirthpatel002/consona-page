import * as z from 'zod/mini'

/** Persisted props. Unknown keys are stripped; an empty source renders a placeholder. */
export const mermaidSchema = z.object({
  source: z.string(),
})

export type MermaidProps = z.infer<typeof mermaidSchema>

/** Small working starter so a new diagram renders immediately and can be replaced. */
export const mermaidTemplate = (): MermaidProps => ({ source: 'flowchart LR\n  A[Start] --> B[Done]' })
