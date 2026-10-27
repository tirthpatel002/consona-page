import { CHEVRON_DOWN_PATH } from './icons'

export const ChevronDownIcon = ({ size = 12 }: { readonly size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d={CHEVRON_DOWN_PATH} />
  </svg>
)
