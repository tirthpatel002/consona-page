import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const SKIP = new Set(['node_modules', '.git', 'dist', '.verify', 'package-lock.json'])
// Built from parts so this file does not contain the word it forbids.
const FORBIDDEN = new RegExp(['no', 'tion'].join(''), 'i')

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return []
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })

/** The repository stays product-neutral: no third-party product names in code, comments, tests or docs. */
describe('product-neutral wording', () => {
  it('has no reference-product name anywhere in the repository', () => {
    const offenders = files(ROOT)
      .filter((file) => /\.(ts|tsx|css|md|json|html|js|mjs)$/.test(file))
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .flatMap((text, index) => (FORBIDDEN.test(text) ? [`${relative(ROOT, file)}:${index + 1}`] : [])),
      )
    expect(offenders).toEqual([])
  })
})
