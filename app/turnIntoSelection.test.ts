// @vitest-environment jsdom
import type { Content, Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { describe, expect, it } from 'vitest'
import {
  createTestEditor,
  turnIntoOptionsForSelection,
  turnIntoSelectionContext,
  runTurnIntoOnSelection,
  composePlugins,
} from '../src/editor/core'
import { pagePlugins } from './plugins'

const definitions = composePlugins(pagePlugins).plugins.flatMap((p) => p.turnInto ?? [])
const definition = (id: string) => {
  const found = definitions.find((d) => d.id === id)
  if (!found) throw new Error(`no definition ${id}`)
  return found
}

const make = (content: Content, from: number, to: number) => {
  const { editor, destroy } = createTestEditor({ plugins: pagePlugins, content })
  editor.chain().setTextSelection({ from, to }).run()
  return { editor, destroy }
}

const options = (editor: Editor) => {
  const context = turnIntoSelectionContext(editor.state)
  return context ? turnIntoOptionsForSelection(definitions, editor.state, context) : []
}

describe('turn into selection context (D2)', () => {
  it('extracts a partial selection into its own converted block, surroundings untouched', () => {
    // '<p>before <strong>mid</strong> after</p>': 'mid' spans doc 9-12
    const { editor, destroy } = make('<p>before <strong>mid</strong> after</p>', 8, 11)
    const context = turnIntoSelectionContext(editor.state)
    expect(context?.kind).toBe('partial')
    if (context?.kind !== 'partial') throw new Error('expected partial')
    runTurnIntoOnSelection(editor, definition('text:turn-into-h1'), context)
    const blocks: string[] = []
    editor.state.doc.forEach((node) => blocks.push(`${node.type.name}:${node.textContent}`))
    expect(blocks).toEqual(['paragraph:before ', 'heading:mid', 'paragraph: after'])
    // surrounding marks and the extracted mark survive
    const heading = editor.state.doc.child(1)
    expect(heading.child(0).marks.map((m) => m.type.name)).toContain('bold')
    const after = editor.state.doc.child(2)
    expect(after.textContent).toBe(' after')
    destroy()
  })

  it('is a single undo step', () => {
    const { editor, destroy } = make('<p>before mid after</p>', 8, 11)
    const context = turnIntoSelectionContext(editor.state)
    if (context?.kind !== 'partial') throw new Error('expected partial')
    runTurnIntoOnSelection(editor, definition('text:turn-into-h1'), context)
    editor.commands.undo()
    expect(editor.getHTML()).toBe('<p>before mid after</p>')
    destroy()
  })

  it('extracts plain selected text into an equation embed', () => {
    // '<p>see E=mc^2 here</p>': 'E=mc^2' spans doc 5-11
    const { editor, destroy } = make('<p>see E=mc^2 here</p>', 5, 11)
    const context = turnIntoSelectionContext(editor.state)
    if (context?.kind !== 'partial') throw new Error('expected partial')
    runTurnIntoOnSelection(editor, definition('block:equation:turn-into'), context)
    const embed = editor.state.doc.child(1)
    expect(embed.type.name).toBe('embedBlock')
    expect(embed.attrs.props).toMatchObject({ latex: 'E=mc^2' })
    expect(editor.state.doc.child(0).textContent).toBe('see ')
    expect(editor.state.doc.child(2).textContent).toBe(' here')
    destroy()
  })

  it('hides embed conversions when the selected fragment is marked', () => {
    const { editor, destroy } = make('<p>see <strong>E=mc^2</strong> here</p>', 5, 11)
    const ids = options(editor).map((d) => d.id)
    expect(ids).not.toContain('block:equation:turn-into')
    expect(ids).toContain('text:turn-into-h1')
    destroy()
  })

  it('multi-block selections offer only conversions every block accepts (intersection)', () => {
    const { editor, destroy } = make('<p>plain</p><p>some <strong>bold</strong></p>', 1, 20)
    const context = turnIntoSelectionContext(editor.state)
    expect(context?.kind).toBe('whole')
    const ids = turnIntoOptionsForSelection(definitions, editor.state, context as never).map((d) => d.id)
    expect(ids).toContain('text:turn-into-h1')
    expect(ids).not.toContain('block:equation:turn-into')
    destroy()
  })

  it('converts every covered block in one undo step', () => {
    const { editor, destroy } = make('<p>one</p><p>two</p>', 1, 10)
    const context = turnIntoSelectionContext(editor.state)
    if (context?.kind !== 'whole') throw new Error('expected whole')
    runTurnIntoOnSelection(editor, definition('text:turn-into-h1'), context)
    const types: string[] = []
    editor.state.doc.forEach((node) => types.push(node.type.name))
    // The editor appends an empty paragraph when a change leaves the document ending on a non-paragraph.
    expect(types).toEqual(['heading', 'heading', 'paragraph'])
    editor.commands.undo()
    expect(editor.getHTML()).toBe('<p>one</p><p>two</p>')
    destroy()
  })

  it('turns a selected code block into text from the selection', () => {
    const { editor, destroy } = make(
      { type: 'doc', content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'alpha' }] }] },
      1,
      6,
    )
    const context = turnIntoSelectionContext(editor.state)
    expect(context?.kind).toBe('whole')
    if (context?.kind !== 'whole') throw new Error('expected whole')
    runTurnIntoOnSelection(editor, definition('text:turn-into-text'), context)
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph')
    expect(editor.state.doc.textContent).toBe('alpha')
    destroy()
  })

  it('extracts part of a code block into a heading', () => {
    const { editor, destroy } = make(
      { type: 'doc', content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'alpha' }] }] },
      1,
      4,
    )
    const context = turnIntoSelectionContext(editor.state)
    expect(context?.kind).toBe('partial')
    if (context?.kind !== 'partial') throw new Error('expected partial')
    runTurnIntoOnSelection(editor, definition('text:turn-into-h1'), context)
    const blocks: string[] = []
    editor.state.doc.forEach((node) => blocks.push(`${node.type.name}:${node.textContent}`))
    expect(blocks[0]).toBe('heading:alp')
    expect(blocks.some((block) => block === 'codeBlock:ha')).toBe(true)
    destroy()
  })

  it('turns selected text inside a list item into a heading, lifting that item out', () => {
    const { editor, destroy } = make('<ul><li><p>One</p></li><li><p>Two</p></li></ul>', 3, 6)
    const context = turnIntoSelectionContext(editor.state)
    expect(context?.kind).toBe('whole')
    if (context?.kind !== 'whole') throw new Error('expected whole')
    const ids = turnIntoOptionsForSelection(definitions, editor.state, context).map((d) => d.id)
    expect(ids).toContain('text:turn-into-h1')
    expect(ids).not.toContain('text:turn-into-bullet-list')
    runTurnIntoOnSelection(editor, definition('text:turn-into-h1'), context)
    expect(editor.state.doc.child(0).type.name).toBe('heading')
    expect(editor.state.doc.child(0).textContent).toBe('One')
    expect(editor.state.doc.child(1).type.name).toBe('bulletList')
    expect(editor.state.doc.child(1).textContent).toBe('Two')
    destroy()
  })

  it('turns a fully selected quote into a heading', () => {
    const { editor, destroy } = make('<blockquote><p>Hello there</p></blockquote>', 2, 13)
    const context = turnIntoSelectionContext(editor.state)
    expect(context?.kind).toBe('whole')
    if (context?.kind !== 'whole') throw new Error('expected whole')
    runTurnIntoOnSelection(editor, definition('text:turn-into-h1'), context)
    expect(editor.state.doc.firstChild?.type.name).toBe('heading')
    expect(editor.state.doc.firstChild?.textContent).toBe('Hello there')
    destroy()
  })

  it('turns a node-selected equation into text', () => {
    const { editor, destroy } = createTestEditor({
      plugins: pagePlugins,
      content: {
        type: 'doc',
        content: [{ type: 'embedBlock', attrs: { blockType: 'equation', props: { latex: 'E = mc^2' } } }],
      },
    })
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)))
    const context = turnIntoSelectionContext(editor.state)
    expect(context).toEqual({ kind: 'whole', positions: [0] })
    if (!context) throw new Error('expected context')
    const ids = turnIntoOptionsForSelection(definitions, editor.state, context).map((d) => d.id)
    expect(ids).toContain('text:turn-into-text')
    expect(ids).not.toContain('block:equation:turn-into')
    runTurnIntoOnSelection(editor, definition('text:turn-into-text'), context)
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph')
    expect(editor.state.doc.textContent).toBe('E = mc^2')
    destroy()
  })

  it('returns null for empty selections and partial edges across blocks', () => {
    const { editor, destroy } = make('<p>one</p><p>two</p>', 3, 8)
    expect(turnIntoSelectionContext(editor.state)).toBeNull()
    editor.chain().setTextSelection(1).run()
    expect(turnIntoSelectionContext(editor.state)).toBeNull()
    destroy()
  })
})
