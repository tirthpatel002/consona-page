import type { SlashItem } from './types'

export interface SlashMenuState {
  readonly open: boolean
  readonly items: readonly SlashItem[]
  readonly activeIndex: number
  readonly anchor: DOMRect | null
}

const CLOSED: SlashMenuState = { open: false, items: [], activeIndex: 0, anchor: null }

/** Tiny external store bridging the Tiptap suggestion plugin and the React menu. */
export class SlashStore {
  private state: SlashMenuState = CLOSED
  private readonly listeners = new Set<() => void>()
  private choose: ((item: SlashItem) => void) | null = null

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getState = (): SlashMenuState => this.state

  show(items: readonly SlashItem[], anchor: DOMRect | null, choose: (item: SlashItem) => void): void {
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
    const item = this.state.items[index]
    if (item && this.choose) this.choose(item)
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

  private set(next: SlashMenuState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}
