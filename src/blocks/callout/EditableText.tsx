import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface EditableTextProps {
  readonly value: string
  readonly label: string
  readonly className: string
  readonly multiline?: boolean
  readonly placeholder?: string
  readonly autoFocus?: boolean
  /** Enter: `commit` blurs (default). `focusNext` saves and moves to `focusNextRef`. */
  readonly enterBehavior?: 'commit' | 'focusNext'
  readonly focusNextRef?: React.RefObject<EditableTextHandle | null>
  /** Runs before focusing next (e.g. expand a closed toggle). */
  readonly onEnterFocusNext?: () => void
  /** Called when text changed on blur/Enter. Returns false to reject (the text reverts). */
  readonly onCommit: (next: string) => boolean
  /** Always runs after blur/Enter (even when the value did not change). */
  readonly onFinish?: () => void
}

export type EditableTextHandle = {
  focus: (at?: 'start' | 'end') => void
}

function readFieldText(element: HTMLElement): string {
  return (element.innerText ?? element.textContent ?? '').replace(/\u00a0/g, ' ').trim()
}

function placeCaret(element: HTMLElement, at: 'start' | 'end') {
  element.focus()
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(at === 'start')
  selection.removeAllRanges()
  selection.addRange(range)
}

/**
 * Plain-text editing inside a block view. Commits as one undo step on blur or Enter (commit mode).
 * Shift+Enter inserts a newline when `multiline` is true. Escape reverts.
 */
export const EditableText = forwardRef<EditableTextHandle, EditableTextProps>(function EditableText(
  {
    value,
    label,
    className,
    multiline = false,
    placeholder,
    autoFocus = false,
    enterBehavior = 'commit',
    focusNextRef,
    onEnterFocusNext,
    onCommit,
    onFinish,
  },
  ref,
) {
  const innerRef = useRef<HTMLSpanElement>(null)

  useImperativeHandle(ref, () => ({
    focus: (at = 'end') => {
      const element = innerRef.current
      if (element) placeCaret(element, at)
    },
  }))

  useEffect(() => {
    const element = innerRef.current
    if (element && document.activeElement !== element && element.textContent !== value) element.textContent = value
  }, [value])

  useEffect(() => {
    if (!autoFocus) return
    const element = innerRef.current
    if (element) placeCaret(element, 'end')
  }, [autoFocus])

  const revert = () => {
    if (innerRef.current) innerRef.current.textContent = value
  }

  const save = () => {
    const element = innerRef.current
    if (!element) return
    const next = readFieldText(element)
    if (next !== value && !onCommit(next)) revert()
  }

  const commit = () => {
    save()
    onFinish?.()
  }

  return (
    <span
      ref={innerRef}
      className={className}
      role="textbox"
      aria-label={label}
      aria-multiline={multiline}
      data-placeholder={placeholder}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      onKeyDown={(event) => {
        event.stopPropagation()
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
          event.preventDefault()
          const range = document.createRange()
          range.selectNodeContents(event.currentTarget)
          const selection = window.getSelection()
          selection?.removeAllRanges()
          selection?.addRange(range)
          return
        }
        if (event.key === 'Escape') {
          revert()
          event.currentTarget.blur()
          return
        }
        if (event.key !== 'Enter') return

        if (enterBehavior === 'focusNext' && !event.shiftKey) {
          event.preventDefault()
          save()
          onEnterFocusNext?.()
          focusNextRef?.current?.focus('start')
          return
        }

        if (multiline && event.shiftKey) return

        if (!multiline || !event.shiftKey) {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
      onBlur={commit}
    >
      {value}
    </span>
  )
})
