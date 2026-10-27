import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })

/**
 * Guard for the operations layer: user-facing document changes go through `defineOperation`.
 * Only these are exempt: operation definitions, tests, the test harness, read-only `can().chain()` probes,
 * selection-only commands and ProseMirror plugin internals (decorations, resize handles, slash clean-up).
 */
describe('operations layer', () => {
  it('has no raw editor.chain() mutations outside operation files', () => {
    const offenders = files('src')
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => !/(defineOperation\.ts|operations\.ts|\.test\.ts|testing\/)/.test(file))
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .map((line, index) => ({ file, line: index + 1, text: line }))
          .filter(({ text }) => /\.chain\(\)/.test(text))
          .filter(({ text }) => !/can\(\)\.chain\(\)/.test(text))
          .filter(({ text }) => !/setNodeSelection/.test(text)),
      )
      .map(({ file, line }) => `${file}:${line}`)
    // Remaining entries are listed explicitly so new raw mutations fail this test.
    expect(offenders).toEqual([])
  })
})
