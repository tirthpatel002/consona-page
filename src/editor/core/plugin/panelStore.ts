/** Which panels are open. Shared by the toolbar, PageEditor and block actions. */
export class PanelStore {
  private open: ReadonlySet<string> = new Set()
  private readonly listeners = new Set<() => void>()

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getState = (): ReadonlySet<string> => this.open

  readonly show = (id: string): void => {
    if (!this.open.has(id)) this.set(new Set([...this.open, id]))
  }

  readonly toggle = (id: string): void => {
    const next = new Set(this.open)
    if (!next.delete(id)) next.add(id)
    this.set(next)
  }

  private set(next: ReadonlySet<string>): void {
    this.open = next
    for (const listener of this.listeners) listener()
  }
}
