import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { analyze } from './scripts/analyze-plugin.ts'

// Build-analysis switches (see README "Bundle size"):
//   ANALYZE=<file.json>   write per-module rendered sizes
//   SOURCEMAP=1           emit source maps (for source-map-explorer)

export default defineConfig({
  plugins: [react(), ...(process.env.ANALYZE ? [analyze(process.env.ANALYZE)] : [])],
  server: {
    port: 5173,
    strictPort: false,
    // Keep scratch/log files from triggering HMR.
    watch: { ignored: ['**/.verify/**', '**/dev-server.log'] },
  },
  build: {
    // One chunk (React + Tiptap/ProseMirror ≈ 760 kB min); raise the 500 kB default instead of code-splitting.
    chunkSizeWarningLimit: 1000,
    sourcemap: !!process.env.SOURCEMAP,
  },
})
