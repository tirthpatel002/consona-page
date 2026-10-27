import { adaptBlockSelectionTurnInto, selectedBlockPositions } from '../block/turnIntoSelection'
import type { TurnIntoDefinition } from '../block/turnInto'
import { openSlashMenuBelow } from '../slash/operations'
import { updateBlockProps } from '../operations/operations'
import type { Editor } from '@tiptap/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BlockAction, BlockModule } from '../block/types'
import { nestedConfig } from './blockEntries'
import { gutterAnchorAt, type GutterAnchor } from './blockGeometry'
import { BlockHandleMenu } from './BlockHandleMenu'
import { blockTargetAt } from './blockTarget'
import { composeBlockMenu } from './composeBlockMenu'
import { startPointerDrag } from './pointerDrag'
import { GripIcon, PlusIcon } from './icons'

export interface BlockGutterProps {
  readonly editor: Editor
  /** Positioned element around the editor; the gutter tracks the pointer over it and is placed inside it. */
  readonly container: HTMLElement
  readonly blocks: ReadonlyMap<string, BlockModule>
  readonly blockActions: readonly BlockAction[]
  /** Registered Turn into conversions; enables intersection filtering for multi-block selections. */
  readonly turnIntoDefinitions?: readonly TurnIntoDefinition[]
  readonly openPanel: (panelId: string) => void
}

/** Transaction meta set when the block menu selects its block, so plugin selection state (block ranges) survives. */
export const KEEP_PLUGIN_SELECTION_META = 'pageKeepPluginSelection'

function selectForMenu(editor: Editor, pos: number): void {
  editor.chain().setMeta(KEEP_PLUGIN_SELECTION_META, true).setNodeSelection(pos).run()
}

const sameAnchor = (a: GutterAnchor | null, b: GutterAnchor | null) =>
  a === b || (!!a && !!b && a.pos === b.pos && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) < 0.5)

/**
 * One gutter for every top-level block (text, lists, tables, embeds): "+" inserts a paragraph below and
 * opens the slash menu; the grip drags the block, or (click) opens the block menu composed from the registry.
 */
export function BlockGutter({
  editor,
  container,
  blocks,
  blockActions,
  turnIntoDefinitions = [],
  openPanel,
}: BlockGutterProps) {
  const [anchor, setAnchor] = useState<GutterAnchor | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const handleRef = useRef<HTMLButtonElement>(null)
  const frozen = useRef(false)

  useEffect(() => {
    frozen.current = menuOpen
  }, [menuOpen])

  useEffect(() => {
    if (!editor.isEditable) return
    let pointerX = 0
    let pointerY: number | null = null
    let frame = 0
    const update = () => {
      frame = 0
      if (frozen.current) return
      const gutter = container.querySelector('.page-gutter')
      if (gutter && pointerY !== null) {
        const reach = gutter.getBoundingClientRect()
        const pad = 16
        if (
          pointerX >= reach.left - pad &&
          pointerX <= reach.right + pad &&
          pointerY >= reach.top - pad &&
          pointerY <= reach.bottom + pad
        ) {
          return
        }
      }
      setAnchor((previous) => {
        const next =
          pointerY === null
            ? null
            : gutterAnchorAt(editor.view, container, pointerX, pointerY, nestedConfig(editor.storage), previous)
        return sameAnchor(previous, next) ? previous : next
      })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const onMove = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('.page-gutter')) return
      pointerX = event.clientX
      pointerY = event.clientY
      schedule()
    }
    const onLeave = () => {
      pointerY = null
      schedule()
    }
    // Touch has no hover: tapping a block brings up its handle (a tap on the handle itself is left alone).
    const onTouchDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      if (event.target instanceof Element && event.target.closest('.page-gutter')) return
      pointerX = event.clientX
      pointerY = event.clientY
      schedule()
    }
    container.addEventListener('pointerdown', onTouchDown)
    container.addEventListener('mousemove', onMove)
    container.addEventListener('mouseleave', onLeave)
    editor.on('update', schedule)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      container.removeEventListener('pointerdown', onTouchDown)
      container.removeEventListener('mousemove', onMove)
      container.removeEventListener('mouseleave', onLeave)
      editor.off('update', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [editor, container])

  const target = anchor ? blockTargetAt(editor.state, anchor.pos) : null
  const sections = useMemo(() => {
    if (!menuOpen || !target) return []
    const block = target.isEmbed ? blocks.get(target.blockType) : undefined
    const selectionPositions = selectedBlockPositions(editor)
    const effectiveActions =
      selectionPositions &&
      selectionPositions.length > 1 &&
      selectionPositions.includes(target.pos) &&
      turnIntoDefinitions.length > 0
        ? adaptBlockSelectionTurnInto(editor, blockActions, turnIntoDefinitions, selectionPositions)
        : blockActions
    return composeBlockMenu({
      target,
      blockTitle: block?.title,
      propsActions: block?.actionsFor(target.props) ?? [],
      blockActions: effectiveActions,
      applyProps: (action) => updateBlockProps.run(editor, target.pos, action.apply()),
      runAction: (action) => action.run({ ...target, editor, openPanel }),
    })
  }, [menuOpen, target, blocks, blockActions, turnIntoDefinitions, editor, openPanel])

  const closeMenu = useCallback(
    (restoreFocus: boolean) => {
      setMenuOpen(false)
      if (restoreFocus) editor.commands.focus()
    },
    [editor],
  )
  const openMenu = useCallback(() => {
    setMenuOpen(true)
  }, [])
  const getHandleRect = useCallback(() => handleRef.current?.getBoundingClientRect() ?? null, [])
  const ignoreHandle = useCallback(() => [handleRef.current], [])

  if (!anchor || !editor.isEditable) return null
  const { pos } = anchor

  return (
    <>
      <div className="page-gutter" style={{ top: anchor.y, left: anchor.x }} contentEditable={false}>
        <button
          type="button"
          className="page-gutter__plus"
          aria-label="Insert block below"
          title="Insert block below"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setMenuOpen(false)
            openSlashMenuBelow.run(editor, pos)
          }}
        >
          <PlusIcon />
        </button>
        <button
          type="button"
          ref={handleRef}
          className="page-gutter__handle"
          aria-label="Block menu (drag to move)"
          title="Click for block menu · drag to move"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.preventDefault()
            startPointerDrag(editor, container, pos, event.nativeEvent, {
              onDragStart: () => {
                setMenuOpen(false)
                frozen.current = true
              },
              onEnd: (dragged) => {
                frozen.current = false
                if (dragged) return
                if (menuOpen) return closeMenu(true)
                selectForMenu(editor, pos)
                openMenu()
              },
            })
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            if (menuOpen) return closeMenu(true)
            selectForMenu(editor, pos)
            openMenu()
          }}
        >
          <GripIcon />
        </button>
      </div>
      {menuOpen && sections.length > 0 && (
        <BlockHandleMenu sections={sections} getAnchor={getHandleRect} onClose={closeMenu} ignore={ignoreHandle} />
      )}
    </>
  )
}
