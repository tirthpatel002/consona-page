export interface AppToast {
  readonly id: number
  readonly text: string
  readonly tone: 'info' | 'error'
  readonly undo?: () => void | Promise<void>
}

type Listener = () => void

let nextId = 1
let current: AppToast | null = null
let dismissTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<Listener>()

const emit = () => listeners.forEach((l) => l())

const clearTimer = () => {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
}

export const getToast = () => current

export const subscribeToast = (listener: Listener) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const dismissToast = (id?: number) => {
  if (id !== undefined && current?.id !== id) return
  clearTimer()
  current = null
  emit()
}

/** Corner notice that does not reserve layout. Auto-dismisses unless sticky. */
export const showToast = (
  text: string,
  options: {
    readonly tone?: 'info' | 'error'
    readonly undo?: () => void | Promise<void>
    /** Keep until dismissed or replaced. */
    readonly sticky?: boolean
    readonly durationMs?: number
  } = {},
) => {
  clearTimer()
  const id = nextId++
  current = { id, text, tone: options.tone ?? 'info', undo: options.undo }
  emit()
  if (!options.sticky) {
    const ms = options.durationMs ?? (options.undo ? 8000 : 3200)
    dismissTimer = setTimeout(() => dismissToast(id), ms)
  }
  return id
}
