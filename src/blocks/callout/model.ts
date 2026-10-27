import * as z from 'zod/mini'
import type { BlockPropsAction } from '../../editor/core'

export const CALLOUT_VARIANTS = ['info', 'success', 'warning', 'danger', 'neutral'] as const
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number]

/** Persisted props. Unknown keys are stripped; `variant` defaults to `info`; `title` is optional. */
export const calloutSchema = z.object({
  variant: z._default(z.enum(CALLOUT_VARIANTS), 'info'),
  title: z.optional(z.string()),
  body: z.string().check(z.minLength(1, 'Callout body is required')),
})

export type CalloutProps = z.infer<typeof calloutSchema>

export const calloutTemplate = (): CalloutProps => ({ variant: 'info', title: 'Note', body: 'Add a note…' })

/** One handle-menu action per variant ("✓" marks the current one). */
export const calloutActions: readonly BlockPropsAction<CalloutProps>[] = CALLOUT_VARIANTS.map((variant) => ({
  id: `callout:variant-${variant}`,
  style: true,
  label: (props: CalloutProps) => `${props.variant === variant ? '✓ ' : ''}Style: ${variant}`,
  apply: (props: CalloutProps) => ({ ...props, variant }),
}))
