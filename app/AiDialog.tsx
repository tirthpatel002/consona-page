import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './ai-tools.css'

/** Shared bounded modal with Escape, trapped Tab and focus restoration. */
export function AiDialog({
  title,
  close,
  children,
  busy = false,
}: {
  readonly title: string
  readonly close: () => void
  readonly children: ReactNode
  readonly busy?: boolean
}) {
  const id = useId()
  const ref = useRef<HTMLElement>(null)
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  }, [close])
  useEffect(() => {
    const previous = document.activeElement
    const root = ref.current
    root?.focus()
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])
  return createPortal(
    <div
      className="ai-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) closeRef.current()
      }}
    >
      <section
        className="ai-dialog"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        aria-busy={busy}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            if (!busy) closeRef.current()
          }
          if (event.key === 'Tab') {
            const elements = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
              ) ?? [],
            )
            const first = elements[0],
              last = elements[elements.length - 1]
            if (!first) {
              event.preventDefault()
              return
            }
            if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
              event.preventDefault()
              last.focus()
            } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) {
              event.preventDefault()
              first.focus()
            }
          }
        }}
      >
        <header className="ai-dialog__header">
          <h2 id={id}>{title}</h2>
          <button type="button" aria-label="Close dialog" disabled={busy} onClick={close}>
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  )
}
