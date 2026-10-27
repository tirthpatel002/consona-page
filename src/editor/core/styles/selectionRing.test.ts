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

  it('is drawn by exactly one rule, in core editor.css', () => {
    expect(painting).toEqual([{ file: CORE_CSS, selector: '.ProseMirror .ProseMirror-selectednode' }])
  })
})
