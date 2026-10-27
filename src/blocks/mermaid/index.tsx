import { blockPlugin, defineBlock, turnIntoEmbed } from '../../editor/core'
import { Mermaid } from './Mermaid'
import { mermaidSchema, mermaidTemplate, type MermaidProps } from './model'
import './mermaid.css'

/** Mermaid diagram block (C2): source edited inline, rendered as SVG with strict security. */
export const mermaidBlock = defineBlock<MermaidProps>({
  type: 'mermaid',
  title: 'Mermaid diagram',
  description: 'Diagram from Mermaid source',
  keywords: ['diagram', 'mermaid', 'flowchart', 'sequence', 'chart'],
  schema: mermaidSchema,
  template: mermaidTemplate,
  render: (props, { editable, update }) => (
    <Mermaid source={props.source} onEdit={editable ? (next) => update({ source: next }) : undefined} />
  ),
})

export const mermaidPlugin = blockPlugin(mermaidBlock, { turnInto: [turnIntoEmbed(mermaidBlock, 'source')] })
