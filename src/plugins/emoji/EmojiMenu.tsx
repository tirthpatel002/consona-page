import { useSyncExternalStore } from 'react'
import { useFloatingPlacement } from '../../editor/core'
import { applyTone, selectedTone } from './data'
import type { EmojiStore } from './store'

/** Floating menu for the inline ":" emoji completion (shared global placement, A3). */
export function EmojiMenu({ store }: { readonly store: EmojiStore }) {
  const { open, items, activeIndex, anchor } = useSyncExternalStore(store.subscribe, store.getState)
  const { ref, placement } = useFloatingPlacement<HTMLDivElement>(open ? anchor : null, {
    minHeight: 120,
  })
  if (!open || !anchor || items.length === 0) return null

  return (
    <div
      ref={ref}
      className="page-slash-menu page-emoji-menu"
      role="listbox"
      aria-label="Emoji suggestions"
      style={{
        top: placement?.top ?? anchor.bottom + 6,
        left: placement?.left ?? anchor.left,
        maxHeight: placement?.maxHeight,
        visibility: placement ? 'visible' : 'hidden',
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {items.map((entry, index) => (
        <button
          key={entry.name}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={index === activeIndex ? 'is-active' : undefined}
          onMouseEnter={() => store.setActive(index)}
          onClick={() => store.select(index)}
        >
          <span className="page-emoji-menu__char" aria-hidden>
            {applyTone(entry, selectedTone())}
          </span>
          <span className="page-emoji-menu__name">{entry.name}</span>
        </button>
      ))}
    </div>
  )
}
