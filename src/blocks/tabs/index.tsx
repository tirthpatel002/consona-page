import { blockPlugin, defineBlock } from '../../editor/core'
import { Tabs } from './Tabs'
import { tabsSchema, tabsTemplate, type TabsProps } from './model'
import './tabs.css'

/** Tabs block (C4): titled tabs with plain-text bodies, edited inline; smooth switch animation (C6). */
export const tabsBlock = defineBlock<TabsProps>({
  type: 'tabs',
  title: 'Tabs',
  description: 'Tabbed content sections',
  presentation: { feedback: 'shell' },
  keywords: ['tabs', 'sections', 'switcher'],
  schema: tabsSchema,
  template: tabsTemplate,
  render: (props, { editable, update }) => (
    <Tabs tabs={props.tabs} onEdit={editable ? (next) => update({ tabs: [...next] }) : undefined} />
  ),
})

export const tabsPlugin = blockPlugin(tabsBlock)
