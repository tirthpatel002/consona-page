import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
}
const external = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })
const plugins = [
  'text',
  'lists',
  'columns',
  'block-actions',
  'block-selection',
  'formatting',
  'comments',
  'emoji',
  'export',
  'media',
  'persistence',
  'props-editor',
  'json-view',
]

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/library',
    lib: {
      entry: {
        react: 'src/package/react.ts',
        engine: 'src/package/engine.ts',
        store: 'src/package/store.ts',
        compact: 'src/package/compact.ts',
        markdown: 'src/package/markdown.ts',
        blocks: 'src/blocks/index.ts',
        'ai-controller': 'src/package/ai-controller.ts',
        'plugins/ai-review': 'src/plugins/ai-review/index.ts',
        'blocks/page-preview': 'src/package/page-preview.ts',
        ...Object.fromEntries(
          plugins.map((name) => [
            `plugins/${name}`,
            `src/plugins/${name}/index.${['text', 'lists', 'columns', 'block-actions', 'block-selection'].includes(name) ? 'ts' : 'tsx'}`,
          ]),
        ),
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
      cssFileName: 'style',
    },
    rollupOptions: {
      external: (id) => external.some((name) => id === name || id.startsWith(`${name}/`)),
      output: { chunkFileNames: 'chunks/[name]-[hash].js' },
    },
  },
})
