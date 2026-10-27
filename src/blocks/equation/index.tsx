import { blockPlugin, defineBlock, turnIntoEmbed } from '../../editor/core'
import { Equation } from './Equation'
import { equationSchema, equationTemplate, type EquationProps } from './model'
import 'katex/dist/katex.min.css'
import './equation.css'

/** Equation block (C1): LaTeX source edited inline, rendered with KaTeX. */
export const equationBlock = defineBlock<EquationProps>({
  type: 'equation',
  title: 'Equation',
  description: 'KaTeX math equation',
  keywords: ['math', 'katex', 'latex', 'formula'],
  schema: equationSchema,
  template: equationTemplate,
  render: (props, { editable, update }) => (
    <Equation latex={props.latex} onEdit={editable ? (next) => update({ latex: next }) : undefined} />
  ),
})

export const equationPlugin = blockPlugin(equationBlock, { turnInto: [turnIntoEmbed(equationBlock, 'latex')] })
