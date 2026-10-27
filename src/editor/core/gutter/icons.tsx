// Outlined 16px icons (stroke = currentColor) for the block gutter.

const common = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

export const PlusIcon = () => (
  <svg {...common}>
    <path d="M8 3.5v9M3.5 8h9" />
  </svg>
)

export const GripIcon = () => (
  <svg {...common} stroke="none" fill="currentColor">
    {[3.5, 8, 12.5].flatMap((y) => [6, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.15} />))}
  </svg>
)
