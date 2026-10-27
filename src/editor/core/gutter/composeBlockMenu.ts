import { TURN_INTO_SECTION } from '../block/turnInto'
import type { BlockAction, BlockTarget, ResolvedPropsAction } from '../block/types'

export interface BlockMenuItem {
  readonly id: string
  readonly label: string
  readonly danger?: boolean
  readonly select: () => void
  /** Nested choices (e.g. Turn into); shown in a flyout, not inline in the parent menu. */
  readonly submenu?: readonly BlockMenuItem[]
}

export interface BlockMenuSection {
  readonly id: string
  readonly label?: string
  readonly items: readonly BlockMenuItem[]
}

export interface ComposeBlockMenuInput {
  readonly target: BlockTarget
  /** Title of the registered block (embeds), used to label its own props actions. */
  readonly blockTitle?: string
  /** The block's own props actions (embeds), shown first. */
  readonly propsActions: readonly ResolvedPropsAction[]
  /** Registry block actions; filtered by `appliesTo(target)`, grouped by `section` in first-seen order, danger last. */
  readonly blockActions: readonly BlockAction[]
  readonly applyProps: (action: ResolvedPropsAction) => void
  readonly runAction: (action: BlockAction) => void
}

const STYLES_LABEL = 'Styles'

/** One "Styles" row with a hover flyout when a block has several variants; a lone variant stays a row. */
const stylesSection = (styles: readonly BlockMenuItem[]): BlockMenuSection | null => {
  if (styles.length > 1) {
    return {
      id: 'styles',
      items: [{ id: 'styles', label: STYLES_LABEL, select: () => undefined, submenu: styles }],
    }
  }
  const only = styles[0]
  return only ? { id: 'styles', items: [only] } : null
}

/** Builds the block (handle) menu for any top-level block from the registry. Pure. */
export function composeBlockMenu(input: ComposeBlockMenuInput): BlockMenuSection[] {
  const { target, blockTitle, propsActions, blockActions, applyProps, runAction } = input
  const sections: BlockMenuSection[] = []
  const styles: BlockMenuItem[] = []
  const ownProps = propsActions.filter((action) => !action.style)
  for (const action of propsActions) {
    if (!action.style) continue
    styles.push({ id: action.id, label: action.label, select: () => applyProps(action) })
  }
  if (ownProps.length > 0) {
    sections.push({
      id: 'props',
      label: blockTitle,
      items: ownProps.map((action) => ({ id: action.id, label: action.label, select: () => applyProps(action) })),
    })
  }
  const groups = new Map<string, BlockMenuItem[]>()
  const turnInto: BlockMenuItem[] = []
  for (const action of blockActions) {
    if (action.appliesTo && !action.appliesTo(target)) continue
    const item: BlockMenuItem = {
      id: action.id,
      label: action.label,
      danger: action.danger,
      select: () => runAction(action),
    }
    if (action.style) {
      styles.push(item)
      continue
    }
    if (action.section === TURN_INTO_SECTION) {
      turnInto.push(item)
      continue
    }
    const key = action.section ?? ''
    const items = groups.get(key) ?? []
    items.push(item)
    groups.set(key, items)
  }
  if (turnInto.length > 0) {
    sections.push({
      id: 'turn-into',
      items: [
        {
          id: 'turn-into',
          label: TURN_INTO_SECTION,
          select: () => undefined,
          submenu: turnInto,
        },
      ],
    })
  }
  const styleSection = stylesSection(styles)
  if (styleSection) sections.push(styleSection)
  for (const [label, items] of groups) {
    // Destructive items (Delete) always close their group, whatever the plugin order.
    const ordered = [...items.filter((item) => !item.danger), ...items.filter((item) => item.danger)]
    sections.push({ id: label === '' ? 'actions' : `section:${label}`, label: label || undefined, items: ordered })
  }
  return sections
}
