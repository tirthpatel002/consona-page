// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { TURN_INTO_UNSUPPORTED, composePlugins, createTestEditor, type BlockAction } from '../src/editor/core'
import { pagePlugins } from './plugins'

const registry = composePlugins(pagePlugins)

const action = (id: string): BlockAction => {
  const found = registry.blockActions.find((a) => a.id === id)
  if (!found) throw new Error(`no block action ${id}`)
  return found
}

const runOnFirstBlock = (id: string, content: string) => {
  const { editor, destroy } = createTestEditor({ plugins: pagePlugins, content })
  const node = editor.state.doc.firstChild
  if (!node) throw new Error('empty doc')
  action(id).run({
    editor,
    pos: 0,
    node,
    nodeType: node.type.name,
    blockType: node.type.name,
    isEmbed: false,
    props: {},
    openPanel: () => undefined,
  })
  return { editor, destroy }
}

describe('turn into conversions (D2)', () => {
  it('turns a paragraph into a toggle, preserving its text', () => {
    const { editor, destroy } = runOnFirstBlock('block:toggle:turn-into', '<p>collapsible me</p>')
    const first = editor.state.doc.firstChild
    expect(first?.type.name).toBe('embedBlock')
    expect(first?.attrs.blockType).toBe('toggle')
    expect(first?.attrs.props).toMatchObject({ title: 'collapsible me' })
    destroy()
  })

  it('turns a paragraph into a code block, preserving its text', () => {
    const { editor, destroy } = runOnFirstBlock('text:turn-into-code', '<p>const x = 1</p>')
    expect(editor.state.doc.firstChild?.type.name).toBe('codeBlock')
    expect(editor.state.doc.textContent).toContain('const x = 1')
    destroy()
  })

  it('turns a paragraph into an equation, carrying text into the latex prop', () => {
    const { editor, destroy } = runOnFirstBlock('block:equation:turn-into', '<p>E = mc^2</p>')
    const first = editor.state.doc.firstChild
    expect(first?.type.name).toBe('embedBlock')
    expect(first?.attrs.blockType).toBe('equation')
    expect(first?.attrs.props).toMatchObject({ latex: 'E = mc^2' })
    destroy()
  })

  it('turns a paragraph into a mermaid diagram, carrying text into the source prop', () => {
    const { editor, destroy } = runOnFirstBlock('block:mermaid:turn-into', '<p>graph TD; A--&gt;B</p>')
    const first = editor.state.doc.firstChild
    expect(first?.attrs.blockType).toBe('mermaid')
    expect(first?.attrs.props).toMatchObject({ source: 'graph TD; A-->B' })
    destroy()
  })

  it('turns a paragraph into a callout, carrying text into the body prop', () => {
    const { editor, destroy } = runOnFirstBlock('block:callout:turn-into', '<p>remember this</p>')
    const first = editor.state.doc.firstChild
    expect(first?.attrs.blockType).toBe('callout')
    expect(first?.attrs.props).toMatchObject({ body: 'remember this' })
    destroy()
  })

  it('turns a heading into a checklist, preserving its text', () => {
    const { editor, destroy } = runOnFirstBlock('lists:turn-into-checklist', '<h2>ship it</h2>')
    expect(editor.state.doc.firstChild?.type.name).toBe('taskList')
    expect(editor.state.doc.textContent).toContain('ship it')
    destroy()
  })

  it('conversion runs are single undo steps', () => {
    const { editor, destroy } = runOnFirstBlock('block:equation:turn-into', '<p>x^2</p>')
    editor.commands.undo()
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph')
    expect(editor.state.doc.textContent).toContain('x^2')
    destroy()
  })
})

describe('turn into content preservation (D2)', () => {
  const targetOf = (content: string) => {
    const { editor, destroy } = createTestEditor({ plugins: pagePlugins, content })
    const node = editor.state.doc.firstChild
    if (!node) throw new Error('empty doc')
    return {
      target: {
        pos: 0,
        node,
        nodeType: node.type.name,
        blockType: node.type.name,
        isEmbed: false,
        props: {},
      } as const,
      destroy,
    }
  }
  const offered = (content: string, id: string) => {
    const { target, destroy } = targetOf(content)
    const result = action(id).appliesTo?.(target) ?? true
    destroy()
    return result
  }

  it('embed conversions reject marked inline content instead of flattening it', () => {
    expect(offered('<p>plain <strong>bold</strong></p>', 'block:equation:turn-into')).toBe(false)
    expect(offered('<p>a <a href="https://example.com">link</a></p>', 'block:callout:turn-into')).toBe(false)
    expect(offered('<p>plain text</p>', 'block:equation:turn-into')).toBe(true)
  })

  it('chain conversions keep marks on the converted block', () => {
    const { editor, destroy } = runOnFirstBlock('text:turn-into-h1', '<p>plain <strong>bold</strong></p>')
    const heading = editor.state.doc.firstChild
    expect(heading?.type.name).toBe('heading')
    const boldText = heading?.child(1)
    expect(boldText?.text).toBe('bold')
    expect(boldText?.marks.map((mark) => mark.type.name)).toContain('bold')
    destroy()
  })

  it('refuses to flatten a linked paragraph into a toggle', () => {
    expect(offered('<p>see <a href="https://example.com">docs</a></p>', 'block:toggle:turn-into')).toBe(false)
  })
})

describe('turn into from non-text blocks', () => {
  const typesOf = (content: Parameters<typeof createTestEditor>[0]['content']) => {
    const { editor, destroy } = createTestEditor({ plugins: pagePlugins, content })
    const node = editor.state.doc.firstChild
    if (!node) throw new Error('empty doc')
    return { editor, destroy, node }
  }

  it('turns a code block into text, one paragraph per line', () => {
    const { editor, destroy, node } = typesOf({
      type: 'doc',
      content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'line one\nline two' }] }],
    })
    action('text:turn-into-text').run({
      editor,
      pos: 0,
      node,
      nodeType: node.type.name,
      blockType: node.type.name,
      isEmbed: false,
      props: {},
      openPanel: () => undefined,
    })
    const blocks: string[] = []
    editor.state.doc.forEach((child) => blocks.push(`${child.type.name}:${child.textContent}`))
    expect(blocks).toEqual(['paragraph:line one', 'paragraph:line two'])
    destroy()
  })

  it('turns a quote into a heading and keeps marks', () => {
    const { editor, destroy } = runOnFirstBlock(
      'text:turn-into-h1',
      '<blockquote><p>Hello <strong>there</strong></p></blockquote>',
    )
    const heading = editor.state.doc.firstChild
    expect(heading?.type.name).toBe('heading')
    expect(heading?.textContent).toBe('Hello there')
    expect(heading?.child(1).marks.map((mark) => mark.type.name)).toContain('bold')
    destroy()
  })

  it('turns a list into text, one paragraph per item, and lifts a single item out', () => {
    const { editor, destroy } = runOnFirstBlock(
      'text:turn-into-text',
      '<ul><li><p>One</p></li><li><p>Two</p></li></ul>',
    )
    const blocks: string[] = []
    editor.state.doc.forEach((child) => blocks.push(`${child.type.name}:${child.textContent}`))
    expect(blocks).toEqual(['paragraph:One', 'paragraph:Two'])
    destroy()

    const item = typesOf('<ul><li><p>Keep</p></li><li><p>Stay</p></li></ul>')
    const listItem = item.editor.state.doc.firstChild?.child(0)
    if (!listItem) throw new Error('missing item')
    action('text:turn-into-text').run({
      editor: item.editor,
      pos: 1,
      node: listItem,
      nodeType: listItem.type.name,
      parentType: 'bulletList',
      blockType: listItem.type.name,
      isEmbed: false,
      props: {},
      openPanel: () => undefined,
    })
    expect(item.editor.state.doc.child(0)?.type.name).toBe('paragraph')
    expect(item.editor.state.doc.child(0)?.textContent).toBe('Keep')
    expect(item.editor.state.doc.child(1)?.type.name).toBe('bulletList')
    expect(item.editor.state.doc.child(1)?.textContent).toBe('Stay')
    item.destroy()
  })

  it('turns an equation back into text and a callout into code', () => {
    const equation = typesOf({
      type: 'doc',
      content: [{ type: 'embedBlock', attrs: { blockType: 'equation', props: { latex: 'E = mc^2' } } }],
    })
    action('text:turn-into-text').run({
      editor: equation.editor,
      pos: 0,
      node: equation.node,
      nodeType: 'embedBlock',
      blockType: 'equation',
      isEmbed: true,
      props: { latex: 'E = mc^2' },
      openPanel: () => undefined,
    })
    expect(equation.editor.state.doc.firstChild?.type.name).toBe('paragraph')
    expect(equation.editor.state.doc.textContent).toBe('E = mc^2')
    equation.destroy()

    const callout = typesOf({
      type: 'doc',
      content: [
        {
          type: 'embedBlock',
          attrs: { blockType: 'callout', props: { variant: 'info', title: 'Note', body: 'remember this' } },
        },
      ],
    })
    action('text:turn-into-code').run({
      editor: callout.editor,
      pos: 0,
      node: callout.node,
      nodeType: 'embedBlock',
      blockType: 'callout',
      isEmbed: true,
      props: {},
      openPanel: () => undefined,
    })
    expect(callout.editor.state.doc.firstChild?.type.name).toBe('codeBlock')
    expect(callout.editor.state.doc.textContent).toBe('Note\nremember this')
    callout.destroy()
  })

  it('turns a code block into an equation, carrying the source', () => {
    const { editor, destroy, node } = typesOf({
      type: 'doc',
      content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'x^2' }] }],
    })
    action('block:equation:turn-into').run({
      editor,
      pos: 0,
      node,
      nodeType: node.type.name,
      blockType: node.type.name,
      isEmbed: false,
      props: {},
      openPanel: () => undefined,
    })
    const first = editor.state.doc.firstChild
    expect(first?.attrs.blockType).toBe('equation')
    expect(first?.attrs.props).toMatchObject({ latex: 'x^2' })
    editor.commands.undo()
    expect(editor.state.doc.firstChild?.type.name).toBe('codeBlock')
    destroy()
  })

  it('turns a column layout and a table into their text', () => {
    const columns = typesOf({
      type: 'doc',
      content: [
        {
          type: 'columnList',
          content: [
            { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Left' }] }] },
            { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Right' }] }] },
          ],
        },
      ],
    })
    action('text:turn-into-text').run({
      editor: columns.editor,
      pos: 0,
      node: columns.node,
      nodeType: columns.node.type.name,
      blockType: columns.node.type.name,
      isEmbed: false,
      props: {},
      openPanel: () => undefined,
    })
    const columnText: string[] = []
    columns.editor.state.doc.forEach((child) => {
      if (child.textContent.length > 0) columnText.push(child.textContent)
    })
    expect(columnText).toEqual(['Left', 'Right'])
    columns.destroy()

    const table = typesOf({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] },
              ],
            },
          ],
        },
      ],
    })
    action('text:turn-into-quote').run({
      editor: table.editor,
      pos: 0,
      node: table.node,
      nodeType: table.node.type.name,
      blockType: table.node.type.name,
      isEmbed: false,
      props: {},
      openPanel: () => undefined,
    })
    expect(table.editor.state.doc.firstChild?.type.name).toBe('blockquote')
    expect(table.editor.state.doc.firstChild?.textContent).toBe('AB')
    table.destroy()
  })

  it('hides the conversion that matches the current block', () => {
    const { destroy, node } = typesOf('<pre><code>alpha</code></pre>')
    const target = {
      pos: 0,
      node,
      nodeType: node.type.name,
      blockType: node.type.name,
      isEmbed: false,
      props: {},
    }
    expect(action('text:turn-into-code').appliesTo?.(target)).toBe(false)
    expect(action('text:turn-into-text').appliesTo?.(target)).toBe(true)
    expect(action('block:equation:turn-into').appliesTo?.(target)).toBe(true)
    const equation = typesOf({
      type: 'doc',
      content: [{ type: 'embedBlock', attrs: { blockType: 'equation', props: { latex: 'x' } } }],
    })
    const equationTarget = {
      pos: 0,
      node: equation.node,
      nodeType: 'embedBlock',
      blockType: 'equation',
      isEmbed: true,
      props: { latex: 'x' },
    }
    expect(action('block:equation:turn-into').appliesTo?.(equationTarget)).toBe(false)
    expect(action('text:turn-into-h2').appliesTo?.(equationTarget)).toBe(true)
    destroy()
    equation.destroy()
  })
})

describe('turn into compatibility registry (D2)', () => {
  it('every registered embed block is convertible or explicitly unsupported, with a reason', () => {
    const convertible = new Set(registry.plugins.flatMap((p) => p.turnInto ?? []).map((d) => d.target))
    for (const type of registry.blocks.keys()) {
      const reason = TURN_INTO_UNSUPPORTED[type]
      expect(
        convertible.has(type) || typeof reason === 'string',
        `block "${type}" needs a turn-into conversion or a TURN_INTO_UNSUPPORTED reason`,
      ).toBe(true)
    }
  })

  it('lists no unsupported block that actually has a conversion', () => {
    const convertible = new Set(registry.plugins.flatMap((p) => p.turnInto ?? []).map((d) => d.target))
    for (const type of Object.keys(TURN_INTO_UNSUPPORTED)) {
      expect(convertible.has(type), `"${type}" is both convertible and listed unsupported`).toBe(false)
    }
  })
})
