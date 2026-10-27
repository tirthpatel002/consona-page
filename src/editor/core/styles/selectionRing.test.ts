import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '../../..')
const CORE_CSS = 'editor/core/styles/editor.css'

const cssFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return cssFiles(path)
    return entry.name.endsWith('.css') ? [path] : []
  })

/** Top-level `selector { declarations }` rules of a stylesheet (comments removed; nesting not used here). */
const rules = (css: string) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector = '', body = '']) => ({
    selector: selector.trim(),
    body,
  }))

/** A rule that paints something around a node-selected block (outline, fill, ring shadow or border). */
const paintsSelection = ({ selector, body }: { selector: string; body: string }) =>
  /ProseMirror-selectednode|\.is-selected\b/.test(selector) &&
  /(^|[;\s])(outline(-color)?|box-shadow|background(-color)?|border(-color)?)\s*:(?!\s*(none|transparent|0)\b)/.test(
    body,
  )

describe('block selection ring', () => {
  const painting = cssFiles(SRC).flatMap((file) =>
    rules(readFileSync(file, 'utf8'))
      .filter(paintsSelection)
      .map((rule) => ({ file: relative(SRC, file), selector: rule.selector })),
  )

  /**
   * Plain nodes are painted by core editor.css; blocks that opt into feedback variants delegate to
   * blockFeedback.css. The core rule is guarded with :not() so the two never paint the same block, which
   * was confirmed in a browser: each node-selected block shows exactly one selection tint.
   */
  it('is painted by the core rule for plain nodes and the inset rule for inset blocks, nothing else', () => {
    expect(painting).toEqual([
      {
        file: 'editor/core/styles/blockFeedback.css',
        selector: expect.stringContaining("[data-block-feedback='inset']"),
      },
      {
        file: CORE_CSS,
        selector:
          ".ProseMirror .ProseMirror-selectednode:not(:has(> .page-block)):not(.page-block):not([data-block-feedback='shell'])",
      },
    ])
  })

  it('keeps the core rule away from blocks that delegate their feedback', () => {
    const core = painting.find((rule) => rule.file === CORE_CSS)?.selector ?? ''
    expect(core).toContain(':not(.page-block)')
    expect(core).toContain(":not([data-block-feedback='shell'])")
    expect(core).toContain(':not(:has(> .page-block))')
  })
})
