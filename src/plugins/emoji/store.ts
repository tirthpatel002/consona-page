import type { EmojiEntry } from './data'

export interface EmojiMenuState {
  readonly open: boolean
  readonly items: readonly EmojiEntry[]
  readonly activeIndex: number
  readonly anchor: DOMRect | null
}

const CLOSED: EmojiMenuState = { open: false, items: [], activeIndex: 0, anchor: null }

/** External store bridging the ":" suggestion plugin and the React menu (mirrors the slash store). */
export class EmojiStore {
  private state: EmojiMenuState = CLOSED
  private readonly listeners = new Set<() => void>()
  private choose: ((entry: EmojiEntry) => void) | null = null

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getState = (): EmojiMenuState => this.state

  show(items: readonly EmojiEntry[], anchor: DOMRect | null, choose: (entry: EmojiEntry) => void): void {
    this.choose = choose
    const activeIndex = Math.min(this.state.open ? this.state.activeIndex : 0, Math.max(items.length - 1, 0))
    this.set({ open: true, items, activeIndex, anchor })
  }

  close(): void {
    this.choose = null
    if (this.state.open) this.set(CLOSED)
  }

  setActive(index: number): void {
    if (this.state.open && index >= 0 && index < this.state.items.length)
      this.set({ ...this.state, activeIndex: index })
  }

  select(index = this.state.activeIndex): void {
    const entry = this.state.items[index]
    if (entry && this.choose) this.choose(entry)
  }

  /** Returns true when the key was handled by the menu. */
  handleKey(event: Pick<KeyboardEvent, 'key'>): boolean {
    const { open, items, activeIndex } = this.state
    if (!open || items.length === 0) return false
    switch (event.key) {
      case 'ArrowDown':
        this.setActive((activeIndex + 1) % items.length)
        return true
      case 'ArrowUp':
        this.setActive((activeIndex - 1 + items.length) % items.length)
        return true
      case 'Enter':
      case 'Tab':
        this.select()
        return true
      case 'Escape':
        this.close()
        return true
      default:
        return false
    }
  }

  private set(next: EmojiMenuState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}
