import type { Editor, EditorEvents } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { allActions, type BlockToolbarAction, type BlockToolbarDefinition } from './blockToolbarDefinition'
import { MenuButton } from './MenuButton'

interface OpenMenu {
  readonly blockPos: number
  readonly id: string
  readonly at?: { readonly x: number; readonly y: number }
}

interface Snapshot {
  readonly pos: number
  readonly enabled: Readonly<Record<string, boolean>>
  readonly active: Readonly<Record<string, boolean>>
  readonly visibleMenus: readonly string[]
}

function sameSnapshot(a: Snapshot | null, b: Snapshot | null): boolean {
  if (a === null || b === null) return a === b
  const same = (x: Readonly<Record<string, boolean>>, y: Readonly<Record<string, boolean>>) =>
    Object.keys(x).length === Object.keys(y).length && Object.keys(x).every((key) => x[key] === y[key])
  return (
    a.pos === b.pos &&
    same(a.enabled, b.enabled) &&
    same(a.active, b.active) &&
    a.visibleMenus.join() === b.visibleMenus.join()
  )
}

/**
 * Renders a plugin's contextual toolbar (`BlockToolbarDefinition`) into the slot of the block that holds
 * the selection: groups of menus and buttons, enabled/active state, and menu open/close handling.
 */
export function BlockToolbar({
  editor,
  definition,
}: {
  readonly editor: Editor
  readonly definition: BlockToolbarDefinition
}) {
  const snapshot = useEditorState({
    editor,
    selector: ({ editor: current }): Snapshot | null => {
      if (!current.isEditable) return null
      const pos = definition.locate(current)
      if (pos === null) return null
      const actions = allActions(definition)
      return {
        pos,
        enabled: Object.fromEntries(actions.map((action) => [action.id, action.can(current)])),
        active: Object.fromEntries(actions.map((action) => [action.id, action.isActive?.(current) ?? false])),
        visibleMenus: definition.groups.flatMap((group) =>
          group.kind === 'menus'
            ? group.menus.filter((menu) => menu.visible?.(current) ?? true).map((menu) => menu.id)
            : [],
        ),
      }
    },
    equalityFn: sameSnapshot,
  })
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null)
  const run = useCallback((action: BlockToolbarAction) => action.run(editor), [editor])

  useEffect(() => {
    const onTransaction = ({ transaction }: EditorEvents['transaction']) => {
      const request = definition.menuRequest?.(transaction, editor)
      const pos = request ? definition.locate(editor) : null
      if (!request || pos === null) return
      setOpenMenu((previous) =>
        previous?.id === request.menuId && previous.at && previous.blockPos === pos
          ? null
          : { blockPos: pos, id: request.menuId, at: request.at },
      )
    }
    editor.on('transaction', onTransaction)
    return () => {
      editor.off('transaction', onTransaction)
    }
  }, [editor, definition])

  if (!snapshot) return null
  const blockDom = editor.view.nodeDOM(snapshot.pos)
  const slot = blockDom instanceof HTMLElement ? definition.slot(blockDom) : null
  if (!slot) return null

  return createPortal(
    <div
      className="page-block-toolbar"
      role="toolbar"
      aria-label={definition.label}
      onMouseDown={(e) => e.preventDefault()}
    >
      {definition.groups.map((group, index) => {
        const key = `${definition.id}:${index}`
        if (group.kind === 'menus') {
          return (
            <div className="page-block-toolbar__group" key={key}>
              {group.menus
                .filter((menu) => snapshot.visibleMenus.includes(menu.id))
                .map((menu) => (
                  <MenuButton
                    key={menu.id}
                    menu={menu}
                    enabled={snapshot.enabled}
                    open={openMenu?.id === menu.id && openMenu.blockPos === snapshot.pos}
                    at={openMenu?.id === menu.id ? openMenu.at : undefined}
                    onOpenChange={(open) => setOpenMenu(open ? { blockPos: snapshot.pos, id: menu.id } : null)}
                    onChoose={run}
                    isMenuOpener={definition.isMenuOpener}
                  />
                ))}
            </div>
          )
        }
        const actions =
          group.kind === 'first-enabled'
            ? group.actions.filter((action) => snapshot.enabled[action.id]).slice(0, 1)
            : group.actions
        if (actions.length === 0) return null
        return (
          <div className="page-block-toolbar__group" key={key}>
            {actions.map((action) => (
              <button
                type="button"
                key={action.id}
                data-action={action.id}
                title={action.title}
                aria-pressed={action.isActive ? (snapshot.active[action.id] ?? false) : undefined}
                className={snapshot.active[action.id] ? 'is-active' : undefined}
                disabled={!snapshot.enabled[action.id]}
                onClick={() => run(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )
      })}
    </div>,
    slot,
  )
}
