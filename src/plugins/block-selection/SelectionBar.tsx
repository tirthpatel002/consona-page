import { useCallback, useRef, useState } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { createPortal } from 'react-dom'
import {
  Icon,
  Menu,
  Popover,
  blockSelectionPluginKey,
  lucideStrokeForSize,
  useFloatingPlacement,
  type AnchorRect,
  type IconName,
  type MenuEntry,
} from '../../editor/core'
import {
  copySelected,
  deleteSelected,
  downloadSelected,
  duplicateSelected,
  moveSelected,
  selectedBlocksJson,
  type SelectionDownloadFormat,
} from './selectionActions'
import { getSelectionHost } from './selectionHost'
import { blockSpans, selectedRange, type BlockSelectionState } from './blockRange'

interface Action {
  readonly id: string
  readonly label: string
  readonly icon: IconName
  readonly danger?: boolean
  readonly enabled: (editor: Editor) => boolean
  readonly run?: (editor: Editor) => void | Promise<void>
  readonly menu?: (editor: Editor, close: () => void) => readonly MenuEntry[]
}

function selectionAnchor(editor: Editor): AnchorRect | null {
  const selection = blockSelectionPluginKey.getState(editor.state) as BlockSelectionState | null
  if (!selection || !editor.isEditable) return null
  const spans =
    selection.scope === undefined
      ? blockSpans(editor.state.doc)
      : (() => {
          const container = editor.state.doc.nodeAt(selection.scope)
          if (!container) return []
          const out: { pos: number; end: number }[] = []
          container.forEach((child, offset) => {
            const pos = (selection.scope ?? 0) + 1 + offset
            out.push({ pos, end: pos + child.nodeSize })
          })
          return out
        })()
  const range = selectedRange(spans, selection)
  if (!range) return null
  try {
    let top = Infinity
    let bottom = -Infinity
    let left = Infinity
    let right = -Infinity
    for (const span of spans) {
      if (span.pos < range.from || span.end > range.to) continue
      const dom = editor.view.nodeDOM(span.pos)
      if (!(dom instanceof HTMLElement)) continue
      const box = dom.getBoundingClientRect()
      top = Math.min(top, box.top)
      bottom = Math.max(bottom, box.bottom)
      left = Math.min(left, box.left)
      right = Math.max(right, box.right)
    }
    if (!Number.isFinite(top)) return null
    return { top, bottom, left, right }
  } catch {
    return null
  }
}

function canMove(editor: Editor, direction: -1 | 1): boolean {
  const selection = blockSelectionPluginKey.getState(editor.state) as BlockSelectionState | null
  if (!selection) return false
  const spans =
    selection.scope === undefined
      ? blockSpans(editor.state.doc)
      : (() => {
          const container = editor.state.doc.nodeAt(selection.scope)
          if (!container) return []
          const out: { pos: number; end: number }[] = []
          container.forEach((child, offset) => {
            const pos = (selection.scope ?? 0) + 1 + offset
            out.push({ pos, end: pos + child.nodeSize })
          })
          return out
        })()
  const lo = Math.min(selection.anchor, selection.head)
  const hi = Math.max(selection.anchor, selection.head)
  return direction < 0 ? lo > 0 : hi < spans.length - 1
}

function downloadEntries(editor: Editor, close: () => void): readonly MenuEntry[] {
  const run = (format: SelectionDownloadFormat) => () => {
    void downloadSelected(editor, format)
    close()
  }
  return [
    { id: 'pdf', label: 'PDF (print dialog)', onSelect: run('pdf') },
    { id: 'docx', label: 'Document (.docx)', onSelect: run('docx') },
    { id: 'markdown', label: 'Markdown (.md)', onSelect: run('markdown') },
    { id: 'text', label: 'Plain text (.txt)', onSelect: run('text') },
  ]
}

const actions: readonly Action[] = [
  {
    id: 'download',
    label: 'Download selected blocks',
    icon: 'download',
    enabled: () => true,
    menu: downloadEntries,
  },
  {
    id: 'up',
    label: 'Move up',
    icon: 'arrow-up',
    enabled: (editor) => canMove(editor, -1),
    run: (editor) => void moveSelected(editor, -1),
  },
  {
    id: 'down',
    label: 'Move down',
    icon: 'arrow-down',
    enabled: (editor) => canMove(editor, 1),
    run: (editor) => void moveSelected(editor, 1),
  },
  {
    id: 'copy',
    label: 'Copy',
    icon: 'copy',
    enabled: () => true,
    run: (editor) => void copySelected(editor),
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    icon: 'duplicate',
    enabled: () => true,
    run: (editor) => void duplicateSelected(editor),
  },
  {
    id: 'move-page',
    label: 'Move to page',
    icon: 'folder-input',
    enabled: () => !!getSelectionHost().moveToPage,
    run: (editor) => {
      const blocks = selectedBlocksJson(editor)
      const move = getSelectionHost().moveToPage
      if (blocks && move) void move(editor, blocks)
    },
  },
  {
    id: 'new-page',
    label: 'New page from selection',
    icon: 'file-plus',
    enabled: () => !!getSelectionHost().createPageWith,
    run: (editor) => {
      const blocks = selectedBlocksJson(editor)
      const create = getSelectionHost().createPageWith
      if (blocks && create) void create(editor, blocks)
    },
  },
  {
    id: 'ai',
    label: 'AI actions',
    icon: 'sparkles',
    enabled: () => !!getSelectionHost().openAiActions,
    run: (editor) => {
      const open = getSelectionHost().openAiActions
      if (open) void open(editor)
    },
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: 'trash',
    danger: true,
    enabled: () => true,
    run: (editor) => void deleteSelected(editor),
  },
]

/** Floating icon bar for an active whole-block selection. */
export function SelectionBar({ editor }: { readonly editor: Editor }) {
  const [menuId, setMenuId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null)
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      anchor: selectionAnchor(current),
      enabled: actions.map((action) => action.enabled(current) && current.isEditable),
    }),
    equalityFn: (a, b) =>
      b !== null &&
      a.anchor?.top === b.anchor?.top &&
      a.anchor?.bottom === b.anchor?.bottom &&
      a.anchor?.left === b.anchor?.left &&
      a.anchor?.right === b.anchor?.right &&
      a.enabled.every((value, i) => value === b.enabled[i]),
  })
  const { ref, placement } = useFloatingPlacement<HTMLDivElement>(state.anchor, {
    prefer: 'top',
    align: 'center',
    gap: 8,
  })
  const closeMenu = useCallback(() => {
    setMenuId(null)
    setMenuAnchor(null)
  }, [])

  if (!state.anchor) return null

  const openAction = actions.find((action) => action.id === menuId)

  return createPortal(
    <>
      <div
        ref={ref}
        className="page-bubble page-selection-bar"
        role="toolbar"
        aria-label="Block selection actions"
        style={{
          left: placement?.left ?? state.anchor.left,
          top: placement?.top ?? state.anchor.top,
          visibility: placement ? 'visible' : 'hidden',
        }}
      >
        <div className="page-bubble__group">
          {actions.map((action, index) => (
            <button
              key={action.id}
              ref={(node) => {
                buttonRefs.current[action.id] = node
              }}
              type="button"
              title={action.label}
              aria-label={action.label}
              aria-haspopup={action.menu ? 'menu' : undefined}
              aria-expanded={action.menu ? menuId === action.id : undefined}
              disabled={!state.enabled[index]}
              className={action.danger ? 'is-danger' : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (action.menu) {
                  if (menuId === action.id) {
                    closeMenu()
                    return
                  }
                  setMenuId(action.id)
                  setMenuAnchor(buttonRefs.current[action.id]?.getBoundingClientRect() ?? null)
                  return
                }
                closeMenu()
                void action.run?.(editor)
              }}
            >
              <Icon name={action.icon} size={16} strokeWidth={lucideStrokeForSize(16, 2)} />
            </button>
          ))}
        </div>
      </div>
      {menuAnchor && openAction?.menu && (
        <Popover anchor={menuAnchor} label={openAction.label} onClose={closeMenu}>
          <Menu entries={[...openAction.menu(editor, closeMenu)]} label={openAction.label} />
        </Popover>
      )}
    </>,
    document.body,
  )
}
