// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  adaptBlockSelectionTurnInto,
  composePlugins,
  createTestEditor,
  selectedBlockPositions,
  turnIntoBubbleItem,
} from '../src/editor/core'
import { pagePlugins } from './plugins'

const registry = composePlugins(pagePlugins)
const definitions = registry.plugins.flatMap((p) => p.turnInto ?? [])
const definition = (id: string) => {
  const found = definitions.find((d) => d.id === id)
  if (!found) throw new Error(`no definition ${id}`)
  return found
}

const make = (content: string) => createTestEditor({ plugins: pagePlugins, content })

const press = (dom: HTMLElement, key: string, init: KeyboardEventInit = {}) =>
  dom.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))

describe('D2 bubble toolbar entry', () => {
  it('is enabled only while a non-empty selection has compatible conversions', () => {
    const { editor, destroy } = make('<p>Alpha beta</p>')
    const item = turnIntoBubbleItem(definitions)
    expect(item.isEnabled?.(editor)).toBe(false) // empty selection
    editor.chain().setTextSelection({ from: 1, to: 5 }).run()
    expect(item.isEnabled?.(editor)).toBe(true)
    destroy()
  })

  it('has no enabled state when nothing is registered', () => {
    const { editor, destroy } = make('<p>Alpha beta</p>')
    editor.chain().setTextSelection({ from: 1, to: 5 }).run()
    expect(turnIntoBubbleItem([]).isEnabled?.(editor)).toBe(false)
    destroy()
  })
})

describe('D2 marquee (block selection) entry', () => {
  it('exposes the selected top-level block positions through the plugin key', () => {
    const { editor, destroy } = make('<p>Alpha</p><p>Bravo</p><p>Charlie</p>')
    editor.commands.setTextSelection(2)
    press(editor.view.dom, 'Escape')
    press(editor.view.dom, 'ArrowDown', { shiftKey: true })
    expect(selectedBlockPositions(editor)).toEqual([0, 7])
    press(editor.view.dom, 'Escape')
    expect(selectedBlockPositions(editor)).toBeNull()
    destroy()
  })

  it('offers only conversions compatible with every selected block (intersection)', () => {
    const { editor, destroy } = make('<p>Alpha</p><h1>Bravo</h1>')
    editor.commands.setTextSelection(2)
    press(editor.view.dom, 'Escape')
    press(editor.view.dom, 'ArrowDown', { shiftKey: true })
    const positions = selectedBlockPositions(editor)
    expect(positions).toHaveLength(2)
    if (!positions) throw new Error('no block selection')
    const actions = adaptBlockSelectionTurnInto(editor, registry.blockActions, definitions, positions)
    const turnIns = actions.filter((a) => a.id.includes('turn-into'))
    // h1->h1 must be excluded (heading already is h1); paragraph-level targets that accept headings stay
    expect(turnIns.map((a) => a.id)).not.toContain('text:turn-into-h1')
    expect(turnIns.length).toBeGreaterThan(0)
    destroy()
  })

  it('converts every selected block in one undo step', () => {
    const { editor, destroy } = make('<p>Alpha</p><p>Bravo</p><p>Charlie</p>')
    editor.commands.setTextSelection(2)
    press(editor.view.dom, 'Escape')
    press(editor.view.dom, 'ArrowDown', { shiftKey: true })
    const positions = selectedBlockPositions(editor)
    if (!positions) throw new Error('no block selection')
    const actions = adaptBlockSelectionTurnInto(editor, registry.blockActions, definitions, positions)
    const quote = actions.find((a) => a.id === definition('text:turn-into-quote').id)
    if (!quote) throw new Error('quote conversion not offered')
    quote.run({ editor } as never)
    const types: string[] = []
    editor.state.doc.forEach((node) => types.push(node.type.name))
    expect(types).toEqual(['blockquote', 'blockquote', 'paragraph'])
    editor.commands.undo()
    expect(editor.getText({ blockSeparator: ',' })).toBe('Alpha,Bravo,Charlie')
    const restored: string[] = []
    editor.state.doc.forEach((node) => restored.push(node.type.name))
    expect(restored).toEqual(['paragraph', 'paragraph', 'paragraph'])
    destroy()
  })

  it('leaves non-turn-into actions untouched', () => {
    const { editor, destroy } = make('<p>Alpha</p><p>Bravo</p>')
    editor.commands.setTextSelection(2)
    press(editor.view.dom, 'Escape')
    press(editor.view.dom, 'ArrowDown', { shiftKey: true })
    const positions = selectedBlockPositions(editor)
    if (!positions) throw new Error('no block selection')
    const actions = adaptBlockSelectionTurnInto(editor, registry.blockActions, definitions, positions)
    const others = actions.filter((a) => !a.id.includes('turn-into'))
    expect(others.map((a) => a.id)).toEqual(
      registry.blockActions.filter((a) => !a.id.includes('turn-into')).map((a) => a.id),
    )
    destroy()
  })
})
