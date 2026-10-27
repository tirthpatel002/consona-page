// Pure keyboard navigation for menus (roving "active" item, disabled items skipped).

export type MenuNavKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End'

export const isMenuNavKey = (key: string): key is MenuNavKey =>
  key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End'

/**
 * Next active index after `key`, wrapping around and skipping disabled items.
 * `current` is -1 when nothing is active. Returns -1 when no item is enabled.
 */
export function moveActiveIndex(enabled: readonly boolean[], current: number, key: MenuNavKey): number {
  const count = enabled.length
  if (!enabled.includes(true)) return -1
  if (key === 'Home') return enabled.indexOf(true)
  if (key === 'End') return enabled.lastIndexOf(true)
  const step = key === 'ArrowDown' ? 1 : -1
  const start = current >= 0 && current < count ? current : step > 0 ? -1 : count
  for (let k = 1; k <= count; k += 1) {
    const index = (((start + step * k) % count) + count) % count
    if (enabled[index]) return index
  }
  return -1
}
