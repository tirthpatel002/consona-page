import { blockPlugin, defineBlock } from '../../editor/core'
import { Breadcrumb } from './Breadcrumb'
import { breadcrumbSchema, breadcrumbTemplate, type BreadcrumbProps } from './model'
import './breadcrumb.css'

/** Breadcrumb block (C3): a nav trail edited inline as " / "-separated labels; hrefs via the Props panel. */
export const breadcrumbBlock = defineBlock<BreadcrumbProps>({
  type: 'breadcrumb',
  title: 'Breadcrumb',
  description: 'Navigation trail with links',
  keywords: ['breadcrumb', 'navigation', 'path', 'crumb'],
  schema: breadcrumbSchema,
  template: breadcrumbTemplate,
  render: (props, { editable, update }) => (
    <Breadcrumb items={props.items} onEdit={editable ? (next) => update({ items: [...next] }) : undefined} />
  ),
})

export const breadcrumbPlugin = blockPlugin(breadcrumbBlock)
