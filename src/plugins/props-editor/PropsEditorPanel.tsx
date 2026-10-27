import { applyBlockProps } from './operations'
import { NodeSelection } from '@tiptap/pm/state'
import { useEditorState, type Editor } from '@tiptap/react'
import { useState } from 'react'
import { BLOCK_NODE_NAME, getBlockModule, isJsonObject, type JsonObject } from '../../editor/core'
import { parsePropsInput } from './parsePropsInput'

interface SelectedBlock {
  readonly pos: number
  readonly blockType: string
  readonly props: JsonObject
}

function selectedBlock(editor: Editor): SelectedBlock | null {
  const { selection } = editor.state
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== BLOCK_NODE_NAME) return null
  const { blockType, props } = selection.node.attrs as Record<string, unknown>
  return {
    pos: selection.from,
    blockType: typeof blockType === 'string' ? blockType : '',
    props: isJsonObject(props) ? props : {},
  }
}

function PropsForm({ editor, block }: { readonly editor: Editor; readonly block: SelectedBlock }) {
  const editable = useEditorState({ editor, selector: ({ editor: current }) => current.isEditable })
  const [text, setText] = useState(() => JSON.stringify(block.props, null, 2))
  const [issues, setIssues] = useState<readonly string[]>([])
  const module = getBlockModule(editor, block.blockType)

  const apply = () => {
    const parsed = parsePropsInput(text)
    if (!parsed.ok) return setIssues([parsed.error])
    const validation = module?.validate(parsed.props)
    if (!validation?.ok) return setIssues(validation?.issues ?? [`Unknown block type "${block.blockType}"`])
    setIssues([])
    applyBlockProps.run(editor, block.pos, parsed.props)
  }

  return (
    <div className="props-editor">
      <div className="props-editor__header">
        <strong>{module?.title ?? block.blockType}</strong>
        <small>props (JSON) · validated on apply · undo with ⌘Z</small>
      </div>
      <textarea
        aria-label="Block props JSON"
        spellCheck={false}
        readOnly={!editable}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') apply()
        }}
      />
      {issues.length > 0 && (
        <ul className="props-editor__issues" role="alert">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      <div className="props-editor__actions">
        <button type="button" onClick={apply} disabled={!editable}>
          Apply (⌘↵)
        </button>
        <button type="button" onClick={() => setText(JSON.stringify(block.props, null, 2))} disabled={!editable}>
          Reset
        </button>
      </div>
    </div>
  )
}

/** Fallback editor for any block: raw props JSON of the node-selected block. */
export function PropsEditorPanel({ editor }: { readonly editor: Editor }) {
  const block = useEditorState({ editor, selector: ({ editor: current }) => selectedBlock(current) })
  if (!block)
    return <p className="props-editor__empty">Select a block (click its frame or ⋯ → Edit props…) to edit its props.</p>
  // Re-mount the form when the selected block or its props change (e.g. after undo).
  return <PropsForm key={`${block.pos}:${JSON.stringify(block.props)}`} editor={editor} block={block} />
}
