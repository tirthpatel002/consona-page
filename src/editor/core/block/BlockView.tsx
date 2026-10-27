import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { isJsonObject, type JsonObject } from '../json'
import { BlockErrorBoundary } from './BlockErrorBoundary'
import { BlockProblem } from './BlockProblem'
import type { BlockNodeOptions } from './blockNodeOptions'

export interface BlockViewProps extends ReactNodeViewProps {
  readonly options: BlockNodeOptions
}

function readAttrs(attrs: Record<string, unknown>): { blockType: string; props: JsonObject } {
  return {
    blockType: typeof attrs.blockType === 'string' ? attrs.blockType : '',
    props: isJsonObject(attrs.props) ? attrs.props : {},
  }
}

/** Node view for every embedded block: outline + label + validated content (handle/menu live in the generic gutter). */
export function BlockView({ node, editor, getPos, updateAttributes, options }: BlockViewProps) {
  const { blockType, props } = readAttrs(node.attrs)
  // editor.isEditable flips without a doc change, so PM never re-renders this view on its own; mirror it.
  const [editable, setEditable] = useState(editor.isEditable)
  useEffect(() => {
    const sync = () => setEditable(editor.isEditable)
    editor.on('transaction', sync)
    return () => {
      editor.off('transaction', sync)
    }
  }, [editor])
  const block = options.blocks.get(blockType)
  const validation = block?.validate(props)

  let content
  if (!block) {
    content = (
      <BlockProblem title={`Unknown block type “${blockType}”`} details={['No registered plugin provides it.']} />
    )
  } else if (!validation?.ok) {
    content = <BlockProblem title={`Invalid ${block.title} props`} details={validation?.issues} />
  } else {
    content = (
      <BlockErrorBoundary blockType={blockType} resetKey={JSON.stringify(props)}>
        {validation.render({
          editable,
          updateProps: (next) => updateAttributes({ props: next }),
          selectBlock: () => {
            const current = getPos()
            if (typeof current === 'number') editor.chain().setNodeSelection(current).focus().run()
          },
        })}
      </BlockErrorBoundary>
    )
  }

  return (
    // Presentation attrs (data-block-feedback, comment thread) live on the PM node view root — see blockNode.ts.
    <NodeViewWrapper>
      <div className="page-block__body" contentEditable={false}>
        {content}
      </div>
    </NodeViewWrapper>
  )
}
