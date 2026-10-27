import { useEditorState, type Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { createPortal } from 'react-dom'
import { useFloatingPlacement, type AnchorRect } from '../ui/placement'
import { ToolbarButton } from './ToolbarButton'
import type { ToolbarItem } from './types'

/**
 * The bubble toolbar: appears over a non-empty text selection, or a selected block, and shows the
 * plugins' `placement: 'bubble'` items. Uses the shared space-aware placement (prefers above the
 * selection, flips below when there is no room, stays inside the viewport) instead of a blind transform.
 */
export function BubbleToolbar({ editor, items }: { readonly editor: Editor; readonly items: readonly ToolbarItem[] }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }): { anchor: AnchorRect | null; active: boolean[]; enabled: boolean[] } => {
      const { selection } = current.state
      const blockNode = selection instanceof NodeSelection && selection.node.isBlock
      const visible = !selection.empty && current.isEditable && (selection.$from.parent.isTextblock || blockNode)
      let anchor: AnchorRect | null = null
      if (visible) {
        try {
          const start = current.view.coordsAtPos(selection.from)
          const end = current.view.coordsAtPos(selection.to)
          anchor = {
            top: Math.min(start.top, end.top),
            bottom: Math.max(start.bottom, end.bottom),
            left: Math.min(start.left, end.left),
            right: Math.max(start.right, end.right),
          }
        } catch {
          anchor = null
        }
      }
      return {
        anchor,
        active: items.map((item) => item.isActive?.(current) ?? false),
        enabled: items.map((item) => (item.isEnabled?.(current) ?? true) && current.isEditable),
      }
    },
    equalityFn: (a, b) =>
      b !== null &&
      a.anchor?.top === b.anchor?.top &&
      a.anchor?.bottom === b.anchor?.bottom &&
      a.anchor?.left === b.anchor?.left &&
      a.anchor?.right === b.anchor?.right &&
      a.active.every((value, i) => value === b.active[i]) &&
      a.enabled.every((value, i) => value === b.enabled[i]),
  })
  const { ref, placement } = useFloatingPlacement<HTMLDivElement>(state.anchor, {
    prefer: 'top',
    align: 'center',
    gap: 8,
  })

  if (items.length === 0 || !state.anchor) return null
  const groups = new Map<string, ToolbarItem[]>()
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])

  return createPortal(
    <div
      ref={ref}
      className="page-bubble"
      role="toolbar"
      aria-label="Text formatting"
      style={{
        left: placement?.left ?? state.anchor.left,
        top: placement?.top ?? state.anchor.top,
        visibility: placement ? 'visible' : 'hidden',
      }}
    >
      {[...groups.values()].map((group) => (
        <div className="page-bubble__group" key={group[0]?.group}>
          {group.map((item) => (
            <ToolbarButton
              key={item.id}
              editor={editor}
              item={item}
              active={state.active[items.indexOf(item)] ?? false}
              enabled={state.enabled[items.indexOf(item)] ?? false}
            />
          ))}
        </div>
      ))}
    </div>,
    document.body,
  )
}
