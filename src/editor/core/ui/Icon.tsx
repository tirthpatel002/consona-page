import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeftRight,
  Bold,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  Flag,
  Maximize2,
  Heading1,
  Heading2,
  History,
  Italic,
  Leaf,
  Lightbulb,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Lock,
  LockOpen,
  MessageSquare,
  Palette,
  Pencil,
  Plane,
  Plus,
  Quote,
  Redo2,
  SlidersHorizontal,
  Smile,
  Sparkles,
  SquareCode,
  Strikethrough,
  Trophy,
  Underline,
  Trash2,
  Undo2,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react'

const icons = {
  bold: Bold,
  italic: Italic,
  underline: Underline,
  strike: Strikethrough,
  code: Code,
  copy: Copy,
  link: Link,
  color: Palette,
  chevron: ChevronDown,
  'chevron-right': ChevronRight,
  check: Check,
  h1: Heading1,
  h2: Heading2,
  'bullet-list': List,
  'ordered-list': ListOrdered,
  checklist: ListChecks,
  quote: Quote,
  'code-block': SquareCode,
  undo: Undo2,
  redo: Redo2,
  lock: Lock,
  unlock: LockOpen,
  export: Download,
  expand: Maximize2,
  eye: Eye,
  pencil: Pencil,
  plus: Plus,
  close: X,
  emoji: Smile,
  'emoji-recent': History,
  'emoji-smileys': Smile,
  'emoji-nature': Leaf,
  'emoji-food': UtensilsCrossed,
  'emoji-activity': Trophy,
  'emoji-travel': Plane,
  'emoji-objects': Lightbulb,
  'emoji-symbols': Sparkles,
  'emoji-flags': Flag,
  history: History,
  comment: MessageSquare,
  'align-left': AlignLeft,
  'align-center': AlignCenter,
  'align-right': AlignRight,
  'open-external': ExternalLink,
  more: Ellipsis,
  trash: Trash2,
  sliders: SlidersHorizontal,
  braces: Braces,
  'turn-into': ArrowLeftRight,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof icons

/** Lucide at 24px uses stroke 2; scale stroke with render size for consistent weight. */
export function lucideStrokeForSize(size: number, strokeAt24 = 2): number {
  return (strokeAt24 * size) / 24
}

/** Top toolbar and panel toggles. */
export const TOOLBAR_ICON = {
  size: 16,
  strokeWidth: lucideStrokeForSize(16, 2),
  className: 'page-icon',
} as const

export function Icon({
  name,
  size = 16,
  strokeWidth = lucideStrokeForSize(size, 2),
  className = 'page-icon',
}: {
  readonly name: IconName
  readonly size?: number
  readonly strokeWidth?: number
  readonly className?: string
}) {
  const Lucide = icons[name]
  return <Lucide size={size} strokeWidth={strokeWidth} className={className} aria-hidden focusable={false} />
}
