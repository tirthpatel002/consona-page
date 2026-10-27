import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useState } from 'react'
import { Icon, lucideStrokeForSize } from '../../editor/core'

const ICON = { size: 15, strokeWidth: lucideStrokeForSize(15, 2) } as const

/** Code block framed like the Mermaid source view: one action bar, scroll in both axes, cap at 500px. */
export function CodeBlockView({ node }: ReactNodeViewProps) {
  const [copied, setCopied] = useState(false)
  const language = typeof node.attrs.language === 'string' ? node.attrs.language : ''

  return (
    <NodeViewWrapper data-language={language || undefined}>
      <div className="page-code-block__toolbar" contentEditable={false} data-block-ui="">
        {language ? <span className="page-code-block__lang">{language}</span> : null}
        <button
          type="button"
          title={copied ? 'Copied' : 'Copy code'}
          aria-label={copied ? 'Copied' : 'Copy code'}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={async () => {
            if (!navigator.clipboard?.writeText) return
            try {
              await navigator.clipboard.writeText(node.textContent)
            } catch {
              return
            }
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1600)
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} {...ICON} />
        </button>
      </div>
      <pre spellCheck={false}>
        <NodeViewContent<'code'> as="code" />
      </pre>
    </NodeViewWrapper>
  )
}
