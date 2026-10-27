import type { Editor } from '@tiptap/core'
import { Fragment, type Node as PMNode } from '@tiptap/pm/model'
import { blockSelectionPluginKey, isBlockId } from '../../editor/core'
import type { AiTarget } from './controller'

/** Snapshot before opening UI. Partial selections keep the untouched inline Markdown on either side. */
export function captureAiTargets(
  editor: Editor,
  serialize: (node: PMNode) => string,
  wholePage = false,
): readonly AiTarget[] {
  const { doc, selection } = editor.state
  const blockSelection = blockSelectionPluginKey.getState(editor.state) as {
    anchor: number
    head: number
    scope?: number
  } | null
  const selectedPositions = new Set<number>()
  if (blockSelection && !wholePage) {
    const parent = blockSelection.scope === undefined ? doc : doc.nodeAt(blockSelection.scope)
    parent?.forEach((_node, offset, index) => {
      if (
        index >= Math.min(blockSelection.anchor, blockSelection.head) &&
        index <= Math.max(blockSelection.anchor, blockSelection.head)
      )
        selectedPositions.add(offset + (blockSelection.scope === undefined ? 0 : blockSelection.scope + 1))
    })
  }
  const targets: AiTarget[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock || !isBlockId(node.attrs.blockId)) return true
    const selectedBlock = [...selectedPositions].some(
      (start) => pos >= start && pos < start + (doc.nodeAt(start)?.nodeSize ?? 0),
    )
    if (!wholePage && selectedPositions.size > 0 && !selectedBlock) return false
    if (
      !wholePage &&
      selectedPositions.size === 0 &&
      (selection.empty
        ? !(selection.from > pos && selection.from < pos + node.nodeSize)
        : !(selection.to > pos + 1 && selection.from < pos + node.nodeSize - 1))
    )
      return false
    const partial = !wholePage && selectedPositions.size === 0 && !selection.empty
    const from = partial ? Math.max(0, selection.from - pos - 1) : 0
    const to = partial ? Math.min(node.content.size, selection.to - pos - 1) : node.content.size
    if (from > to) return false
    const chosen = node.content.cut(from, to)
    const transformed = Fragment.fromArray(
      Array.from({ length: chosen.childCount }, (_, index) => {
        const child = chosen.child(index)
        return child.isText ? editor.schema.text((child.text ?? '').toUpperCase(), child.marks) : child
      }),
    )
    targets.push({
      uppercaseMarkdown: serialize(
        node.copy(node.content.cut(0, from).append(transformed).append(node.content.cut(to))),
      ),
      id: node.attrs.blockId as string,
      before: serialize(node.copy(node.content.cut(0, from))),
      selected: serialize(node.copy(node.content.cut(from, to))),
      after: serialize(node.copy(node.content.cut(to))),
    })
    return false
  })
  return targets
}
