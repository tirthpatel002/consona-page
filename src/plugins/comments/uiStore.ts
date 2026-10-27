/** Which thread is focused in the panel; set by clicking an anchor or a thread card. */
class CommentsUiStore {
  private selected: string | null = null
  private openTick = 0
  private blockComposerPos: number | null = null
  private readonly listeners = new Set<() => void>()

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSelected = (): string | null => this.selected

  /** Bumped when something without panel access (the bubble composer) wants the panel open. */
  readonly getOpenTick = (): number => this.openTick

  readonly select = (threadId: string | null): void => {
    if (this.selected === threadId) return
    this.selected = threadId
    for (const listener of this.listeners) listener()
  }

  readonly selectAndOpen = (threadId: string): void => {
    this.selected = threadId
    this.openTick += 1
    for (const listener of this.listeners) listener()
  }

  /** Block-menu "Comment" asks the overlay for a composer anchored at this block position. */
  readonly getBlockComposerPos = (): number | null => this.blockComposerPos

  readonly openBlockComposer = (pos: number): void => {
    this.blockComposerPos = pos
    for (const listener of this.listeners) listener()
  }

  readonly closeBlockComposer = (): void => {
    if (this.blockComposerPos === null) return
    this.blockComposerPos = null
    for (const listener of this.listeners) listener()
  }
}

export const commentsUi = new CommentsUiStore()
