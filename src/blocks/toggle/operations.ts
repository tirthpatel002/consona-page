import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { BLOCK_NODE_NAME, defineOperation, toJsonObject } from '../../editor/core'
import type { ToggleProps } from './model'
import { toggleTemplate } from './model'

const TOGGLE_BLOCK_TYPE = 'toggle'

function readToggleProps(raw: unknown): ToggleProps {
  if (typeof raw !== 'object' || raw === null) return toggleTemplate()
  const record = raw as Record<string, unknown>
  return {
    open: record.open === false ? false : true,
    level: record.level === 1 || record.level === 2 || record.level === 3 ? record.level : null,
    title: typeof record.title === 'string' ? record.title : '',
    body: typeof record.body === 'string' ? record.body : '',
  }
}

/** Wraps the selected block range in a toggle embed (title = first block, body = the rest). */
export const insertToggleFromSelection = defineOperation('insertToggleFromSelection', (chain) =>
  chain.command(({ state, dispatch, tr }) => {
    const { $from, $to } = state.selection
    const range = $from.blockRange($to)
    if (!range) return false
    const lines: string[] = []
    state.doc.nodesBetween(range.start, range.end, (node) => {
      if (node.isTextblock) lines.push(node.textContent)
    })
    if (lines.length === 0) return false
    const props: ToggleProps = {
      open: true,
      level: null,
      title: lines[0] ?? '',
      body: lines.slice(1).join('\n\n'),
    }
    const embed = state.schema.nodes[BLOCK_NODE_NAME]
    if (!embed) return false
    if (dispatch) {
      tr.replaceWith(range.start, range.end, embed.create({ blockType: TOGGLE_BLOCK_TYPE, props: toJsonObject(props) }))
    }
    return true
  }),
)

const selectionInToggleEmbed = (state: Editor['state']): { pos: number; props: ToggleProps } | null => {
  const { selection } = state
  if (selection instanceof NodeSelection) {
    const selected = selection.node
    if (selected.type.name === BLOCK_NODE_NAME && selected.attrs.blockType === TOGGLE_BLOCK_TYPE) {
      return { pos: selection.from, props: readToggleProps(selected.attrs.props) }
    }
  }
  const { $from } = selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name === BLOCK_NODE_NAME && node.attrs.blockType === TOGGLE_BLOCK_TYPE) {
      return { pos: $from.before(depth), props: readToggleProps(node.attrs.props) }
    }
  }
  return null
}

/** Toggle heading level on embed, or wrap the selection in a toggle embed first (one transaction). */
export const setToggleHeadingOnEmbed = defineOperation('setToggleHeadingOnEmbed', (chain, level: 1 | 2 | 3) =>
  chain.command(({ state, dispatch, tr }) => {
    const found = selectionInToggleEmbed(state)
    if (found) {
      const nextLevel = found.props.level === level ? null : level
      if (dispatch) {
        tr.setNodeAttribute(found.pos, 'props', toJsonObject({ ...found.props, level: nextLevel }))
      }
      return true
    }
    const { $from, $to } = state.selection
    const range = $from.blockRange($to)
    if (!range) return false
    const lines: string[] = []
    state.doc.nodesBetween(range.start, range.end, (node) => {
      if (node.isTextblock) lines.push(node.textContent)
    })
    if (lines.length === 0) return false
    const props: ToggleProps = {
      open: true,
      level,
      title: lines[0] ?? '',
      body: lines.slice(1).join('\n\n'),
    }
    const embed = state.schema.nodes[BLOCK_NODE_NAME]
    if (!embed) return false
    if (dispatch) {
      tr.replaceWith(range.start, range.end, embed.create({ blockType: TOGGLE_BLOCK_TYPE, props: toJsonObject(props) }))
    }
    return true
  }),
)
