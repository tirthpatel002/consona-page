import * as z from 'zod/mini'

/** Persisted props. Unknown keys are stripped; an empty latex source renders a placeholder. */
export const equationSchema = z.object({
  latex: z.string(),
})

export type EquationProps = z.infer<typeof equationSchema>

export const equationTemplate = (): EquationProps => ({ latex: '' })
