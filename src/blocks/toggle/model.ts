import * as z from 'zod/mini'

export const toggleLevelSchema = z.nullable(z.union([z.literal(1), z.literal(2), z.literal(3)]))

export const toggleSchema = z.object({
  open: z._default(z.boolean(), true),
  level: toggleLevelSchema,
  title: z._default(z.string(), ''),
  body: z._default(z.string(), ''),
})

export type ToggleProps = z.infer<typeof toggleSchema>

export const toggleTemplate = (): ToggleProps => ({
  open: true,
  level: null,
  title: '',
  body: '',
})
