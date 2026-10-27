import { useEditorState, type Editor } from '@tiptap/react'

export function JsonPanel({ editor }: { readonly editor: Editor }) {
  const json = useEditorState({
    editor,
    selector: ({ editor: current }) => JSON.stringify(current.getJSON(), null, 2),
  })
  return <pre className="json-view-panel">{json}</pre>
}
