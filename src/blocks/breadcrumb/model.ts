import * as z from 'zod/mini'
import { isSafeUrl } from '../../editor/core'

/** One breadcrumb item: a label, optionally linked. The last item is the current page (never a link). */
export const breadcrumbItem = z.object({
  label: z.string().check(z.minLength(1, 'Breadcrumb labels are required')),
  href: z.optional(z.string().check(z.refine(isSafeUrl, 'Links must use http, https, mailto or tel'))),
})

/** Persisted props. Unknown keys are stripped; an empty list renders a placeholder. */
export const breadcrumbSchema = z.object({
  items: z.array(breadcrumbItem),
})

export type BreadcrumbItem = z.infer<typeof breadcrumbItem>
export type BreadcrumbProps = z.infer<typeof breadcrumbSchema>

export const breadcrumbTemplate = (): BreadcrumbProps => ({
  items: [{ label: 'Docs' }, { label: 'Guides' }, { label: 'Getting started' }],
})

/** Labels joined for inline editing (" / " separators); hrefs stay in props and are kept by position. */
export const joinLabels = (items: readonly BreadcrumbItem[]): string => items.map((item) => item.label).join(' / ')

/**
 * Inline text back into items: split on "/", trim, drop empties. A href survives only when the label
 * at that same position is unchanged — a renamed, reordered or shifted item can never silently keep a
 * link that would now point somewhere unexpected (re-add it via the Props panel).
 */
export const splitLabels = (text: string, previous: readonly BreadcrumbItem[]): BreadcrumbItem[] =>
  text
    .split('/')
    .map((label) => label.trim())
    .filter((label) => label !== '')
    .map((label, index) => {
      const before = previous[index]
      return before && before.label === label && before.href ? { label, href: before.href } : { label }
    })
