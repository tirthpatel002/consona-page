import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The engine entry must be importable without React or styles: nothing it reaches may import them. */
describe('engine import boundary', () => {
  it('reaches no React, no .tsx file and no stylesheet through its static imports', () => {
    const root = normalize(join(__dirname, 'index.ts'))
    const seen = new Set<string>()
    const problems: string[] = []
    const resolve = (from: string, spec: string): string | null => {
      const base = normalize(join(dirname(from), spec))
      return [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].find(existsSync) ?? null
    }
    const walk = (file: string) => {
      if (seen.has(file)) return
      seen.add(file)
      if (file.endsWith('.tsx')) problems.push(`${file} is a .tsx file`)
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/(?:from\s+|import\s+)'([^']+)'/g)) {
        const spec = match[1] as string
        if (/^(react|react-dom|@tiptap\/react)(\/|$)/.test(spec) || spec.endsWith('.css'))
          problems.push(`${file} imports ${spec}`)
        if (spec.startsWith('.')) {
          const next = resolve(file, spec)
          if (next) walk(next)
          else problems.push(`${file}: cannot resolve ${spec}`)
        }
      }
    }
    walk(root)
    expect(problems).toEqual([])
    expect(seen.size).toBeGreaterThan(5)
  })
})
