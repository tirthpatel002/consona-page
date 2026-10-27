import { useSyncExternalStore } from 'react'
import { useFloatingPlacement } from '../ui/placement'
import type { SlashStore } from './slashStore'

export function SlashMenu({ store }: { readonly store: SlashStore }) {
  const { open, items, activeIndex, anchor } = useSyncExternalStore(store.subscribe, store.getState)
  const { ref, placement } = useFloatingPlacement<HTMLDivElement>(open ? anchor : null, {
    minHeight: 160,
  })
  if (!open || !anchor) return null

  return (
    <div
      ref={ref}
      className="page-slash-menu"
      role="listbox"
      style={{
        top: placement?.top ?? anchor.bottom + 6,
        left: placement?.left ?? anchor.left,
        maxHeight: placement?.maxHeight,
        visibility: placement ? 'visible' : 'hidden',
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {items.length === 0 && <div className="page-slash-menu__empty">No matches</div>}
      {items.map((item, index) => {
        const showGroup = index === 0 || items[index - 1]?.group !== item.group
        return (
          <div key={item.id}>
            {showGroup && <div className="page-slash-menu__group">{item.group}</div>}
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? 'is-active' : undefined}
              onMouseEnter={() => store.setActive(index)}
              onClick={() => store.select(index)}
            >
              <span>{item.title}</span>
              {item.description && <small>{item.description}</small>}
            </button>
          </div>
        )
      })}
    </div>
  )
}
