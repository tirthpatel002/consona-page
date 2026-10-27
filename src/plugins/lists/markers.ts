export const BULLET_MARKERS = [
  { id: 'disc', label: 'Disc' },
  { id: 'circle', label: 'Circle' },
  { id: 'square', label: 'Square' },
] as const

export const ORDERED_MARKERS = [
  { id: 'decimal', label: '1, 2, 3' },
  { id: 'lower-alpha', label: 'a, b, c' },
  { id: 'lower-roman', label: 'i, ii, iii' },
] as const

export const MARKER_IDS: readonly string[] = [...BULLET_MARKERS, ...ORDERED_MARKERS].map((m) => m.id)
