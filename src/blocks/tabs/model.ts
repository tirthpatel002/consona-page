import * as z from 'zod/mini'

/** One tab: stable id for keys, a short title, plain-text body. */
export const tabItem = z.object({
  id: z.string().check(z.minLength(1)),
  title: z.string().check(z.minLength(1, 'Tab titles are required')),
  body: z.string(),
})

/** Persisted props. Unknown keys are stripped; an empty tab list renders a placeholder. */
export const tabsSchema = z.object({
  tabs: z.array(tabItem),
})

export type TabItem = z.infer<typeof tabItem>
export type TabsProps = z.infer<typeof tabsSchema>

const newTab = (title: string, body: string): TabItem => ({ id: crypto.randomUUID(), title, body })

export const tabsTemplate = (): TabsProps => ({
  tabs: [newTab('First tab', 'Content of the first tab.'), newTab('Second tab', 'Content of the second tab.')],
})

/** A new empty tab appended after the current ones. */
export const addTab = (tabs: readonly TabItem[]): TabItem[] => [...tabs, newTab(`Tab ${tabs.length + 1}`, '')]
