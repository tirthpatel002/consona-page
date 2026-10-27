import fs from 'node:fs'
import type { Plugin } from 'vite'

/** Build-time report of rendered (pre-minify) size per module, written as JSON to `out`. */
export function analyze(out: string): Plugin {
  return {
    name: 'module-size-report',
    apply: 'build',
    generateBundle(_options, bundle) {
      const rows: { id: string; size: number }[] = []
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        for (const [id, info] of Object.entries(output.modules)) rows.push({ id, size: info.renderedLength })
      }
      rows.sort((a, b) => b.size - a.size)
      fs.writeFileSync(out, JSON.stringify(rows, null, 1))
    },
  }
}
