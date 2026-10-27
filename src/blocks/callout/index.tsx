import { blockPlugin, defineBlock, turnIntoEmbed } from '../../editor/core'
import { Callout } from './Callout'
import { calloutActions, calloutSchema, calloutTemplate, type CalloutProps } from './model'
import './callout.css'

/**
 * Example embed block: any React component becomes a block through `defineBlock` (metadata, props schema,
 * template, optional props actions, presentation, render). Shell blocks put `page-block__shell` on the root.
 * See README "Add a block".
 */
export const calloutBlock = defineBlock<CalloutProps>({
  type: 'callout',
  title: 'Callout',
  description: 'Highlighted note',
  presentation: { feedback: 'shell' },
  keywords: ['note', 'alert', 'info', 'warning', 'tip'],
  schema: calloutSchema,
  template: calloutTemplate,
  actions: calloutActions,
  render: (props, { editable, update }) => (
    <Callout
      variant={props.variant}
      title={props.title}
      body={props.body}
      onEdit={
        editable
          ? (field, next) =>
              field === 'title'
                ? update({ ...props, title: next === '' ? undefined : next })
                : update({ ...props, body: next })
          : undefined
      }
    />
  ),
})

export const calloutPlugin = blockPlugin(calloutBlock, { turnInto: [turnIntoEmbed(calloutBlock, 'body')] })
