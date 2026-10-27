import { blockPlugin, defineBlock, turnIntoEmbed } from '../../editor/core'
import { Toggle } from './Toggle'
import { toggleSchema, toggleTemplate, type ToggleProps } from './model'
import './toggle.css'

export const toggleBlock = defineBlock<ToggleProps>({
  type: 'toggle',
  title: 'Toggle',
  description: 'Collapsible section',
  presentation: { feedback: 'inset' },
  keywords: ['collapse', 'accordion', 'details'],
  schema: toggleSchema,
  template: toggleTemplate,
  render: (props, { editable, update }) => (
    <Toggle
      open={props.open}
      level={props.level}
      title={props.title}
      body={props.body}
      onEdit={
        editable
          ? {
              toggleOpen: () => update({ ...props, open: !props.open }),
              setTitle: (next) => update({ ...props, title: next }),
              setBody: (next) => update({ ...props, body: next }),
            }
          : undefined
      }
    />
  ),
})

export const togglePlugin = blockPlugin(toggleBlock, {
  turnInto: [turnIntoEmbed(toggleBlock, 'title')],
})

export { insertToggleFromSelection, setToggleHeadingOnEmbed } from './operations'
