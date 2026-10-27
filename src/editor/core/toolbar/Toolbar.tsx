import { useEditorState, type Editor } from '@tiptap/react'
import type { BlockModule } from '../block/types'
import type { PanelDefinition } from '../plugin/types'
import { insertBlock } from '../operations/operations'
import { PanelToggleButton } from './PanelToggleButton'
import { ToolbarButton } from './ToolbarButton'
import type { ToolbarItem } from './types'

interface ToolbarProps {
  readonly editor: Editor
  /** Optional document title. Prefer the banner for the page name so the toolbar stays tools-only. */
  readonly title?: string
  readonly items: readonly ToolbarItem[]
  readonly blocks: ReadonlyMap<string, BlockModule>
  readonly panels: readonly PanelDefinition[]
  readonly openPanels: ReadonlySet<string>
  readonly onTogglePanel: (id: string) => void
}

function groupItems(items: readonly ToolbarItem[]): ToolbarItem[][] {
  const groups = new Map<string, ToolbarItem[]>()
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])
  return [...groups.values()]
}

export function Toolbar({ editor, title, items, blocks, panels, openPanels, onTogglePanel }: ToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      active: items.map((item) => item.isActive?.(current) ?? false),
      enabled: items.map((item) => item.isEnabled?.(current) ?? current.isEditable),
    }),
    equalityFn: (a, b) =>
      b !== null &&
      a.active.length === b.active.length &&
      a.active.every((value, i) => value === b.active[i]) &&
      a.enabled.every((value, i) => value === b.enabled[i]),
  })

  return (
    <header className="page-toolbar">
      {title ? <strong className="page-toolbar__title">{title}</strong> : null}
      {groupItems(items).map((group) => (
        <div className="page-toolbar__group" key={group[0]?.group}>
          {group.map((item) => (
            <ToolbarButton
              key={item.id}
              editor={editor}
              item={item}
              active={state.active[items.indexOf(item)] ?? false}
              enabled={state.enabled[items.indexOf(item)] ?? true}
            />
          ))}
        </div>
      ))}
      {blocks.size > 0 && (
        <select
          aria-label="Insert block"
          value=""
          disabled={!editor.isEditable}
          onChange={(event) => {
            if (event.target.value) insertBlock.run(editor, event.target.value)
          }}
        >
          <option value="">+ Insert block…</option>
          {[...blocks.values()].map((block) => (
            <option key={block.type} value={block.type}>
              {block.title}
            </option>
          ))}
        </select>
      )}
      <span className="page-toolbar__spacer" />
      {panels.map((panel) => (
        <PanelToggleButton
          key={panel.id}
          editor={editor}
          panel={panel}
          pressed={openPanels.has(panel.id)}
          onToggle={() => onTogglePanel(panel.id)}
        />
      ))}
    </header>
  )
}
