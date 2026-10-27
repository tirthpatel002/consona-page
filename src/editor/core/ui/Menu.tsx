import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { isMenuNavKey, moveActiveIndex } from '../menu/menuNavigation'

export interface MenuEntry {
  readonly id: string
  readonly label: ReactNode
  readonly active?: boolean
  /** Disabled entries render greyed out and cannot be chosen (e.g. Import while the page is locked). */
  readonly disabled?: boolean
  readonly onSelect: () => void
}

/** Keyboard-navigable vertical list (arrows / Home / End / Enter). Shared by menus and popovers. */
export function Menu({ entries, label }: { readonly entries: readonly MenuEntry[]; readonly label: string }) {
  const [active, setIndex] = useState(0)
  const index = Math.min(active, Math.max(entries.length - 1, 0))

  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key
    if (isMenuNavKey(key)) {
      event.preventDefault()
      setIndex((current) =>
        moveActiveIndex(
          entries.map((entry) => !entry.disabled),
          current,
          key,
        ),
      )
    } else if (event.key === 'Enter') {
      event.preventDefault()
      entries[index]?.onSelect()
    }
  }

  return (
    <div className="page-menu" role="menu" aria-label={label} onKeyDown={onKeyDown}>
      {entries.map((entry, i) => (
        <button
          type="button"
          role="menuitem"
          key={entry.id}
          className={`page-menu__item${i === index ? ' is-highlighted' : ''}${entry.active ? ' is-active' : ''}`}
          disabled={entry.disabled}
          aria-disabled={entry.disabled || undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={entry.disabled ? undefined : entry.onSelect}
        >
          {entry.label}
        </button>
      ))}
    </div>
  )
}
