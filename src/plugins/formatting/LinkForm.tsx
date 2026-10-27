import type { Editor } from '@tiptap/core'
import { useState, type FormEvent } from 'react'
import { setLink, unsetLink } from '../../editor/core'
import { normalizeUrl } from './normalizeUrl'

/** Popover content: add, edit or remove the link on the selection. */
export function LinkForm({ editor, close }: { readonly editor: Editor; readonly close: () => void }) {
  const existing = (editor.getAttributes('link').href as string | undefined) ?? ''
  const [value, setValue] = useState(existing)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const href = normalizeUrl(value)
    if (href) setLink.run(editor, href)
    else unsetLink.run(editor)
    close()
  }

  return (
    <form className="page-link-form" onSubmit={submit}>
      <input
        autoFocus
        type="text"
        inputMode="url"
        aria-label="Link URL"
        placeholder="Paste or type a link"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit">Apply</button>
      {existing && (
        <button
          type="button"
          onClick={() => {
            unsetLink.run(editor)
            close()
          }}
        >
          Remove
        </button>
      )}
    </form>
  )
}
