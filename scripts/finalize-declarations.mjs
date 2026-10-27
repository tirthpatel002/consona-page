import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'

// TypeScript emits bundler-style relative specifiers. Add real paths so NodeNext consumers work too.
const root = resolve('dist/library/types')
async function visit(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, item.name)
    if (item.isDirectory()) await visit(path)
    else if (path.endsWith('.d.ts')) {
      const source = await readFile(path, 'utf8')
      const matches = [...source.matchAll(/['"](\.\.?\/[^'"\s]+)['"]/g)]
      let output = source
      for (const [, specifier] of matches) {
        if (/\.(?:js|css|json)$/.test(specifier)) continue
        const base = resolve(dirname(path), specifier)
        const isFile = await stat(`${base}.d.ts`).then(
          () => true,
          () => false,
        )
        const next = `${specifier}${isFile ? '.js' : '/index.js'}`
        output = output.replaceAll(`'${specifier}'`, `'${next}'`).replaceAll(`"${specifier}"`, `"${next}"`)
      }
      await writeFile(path, output)
    }
  }
}
await visit(root)
