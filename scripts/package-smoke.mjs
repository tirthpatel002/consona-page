import process from 'node:process'
import { log } from 'node:console'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const temp = mkdtempSync(join(tmpdir(), 'page-consumer-'))
const run = (args, cwd = temp) => execFileSync(process.execPath, args, { cwd, stdio: 'inherit' })
const npm = (args, cwd = temp) =>
  execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
try {
  const receipt = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', temp], root))[0]
  const files = receipt.files.map((item) => item.path)
  assert(files.includes('dist/library/engine.js'))
  assert(files.includes('dist/library/style.css'))
  assert(!files.some((path) => /^(app|src|\.verify|node_modules)\//.test(path)))
  for (const target of Object.values(pkg.exports)) {
    for (const path of typeof target === 'string' ? [target] : Object.values(target)) {
      assert(files.includes(path.replace(/^\.\//, '')), `Missing packed export: ${path}`)
    }
  }
  // Check the emitted graph as well as import success: React must never leak into headless entries.
  const visited = new Set()
  function checkHeadless(path) {
    if (visited.has(path)) return
    visited.add(path)
    const source = readFileSync(path, 'utf8')
    for (const [, specifier] of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      assert(!/^(?:react(?:-dom)?(?:\/|$)|@tiptap\/react(?:\/|$))/.test(specifier), `React in headless graph: ${path}`)
      assert(!specifier.endsWith('.css'), `CSS in headless graph: ${path}`)
      if (specifier.startsWith('.')) checkHeadless(resolve(dirname(path), specifier))
    }
  }
  for (const entry of ['engine', 'store', 'compact', 'markdown'])
    checkHeadless(resolve(root, `dist/library/${entry}.js`))
  writeFileSync(join(temp, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  npm([
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    join(temp, receipt.filename),
    `typescript@${pkg.devDependencies.typescript}`,
    '@types/react',
    '@types/react-dom',
    `jsdom@${pkg.devDependencies.jsdom}`,
    `vite@${pkg.devDependencies.vite}`,
  ])
  // Resolve from a separate installed consumer, not the repository or a symlink.
  writeFileSync(
    join(temp, 'node.mjs'),
    `
import assert from 'node:assert/strict'
assert.equal(typeof document, 'undefined')
assert.equal(typeof window, 'undefined')
const store = await import('${pkg.name}/store')
const engine = await import('${pkg.name}/engine')
const compact = await import('${pkg.name}/compact')
const markdown = await import('${pkg.name}/markdown')
assert.equal(typeof engine.createPagesEngine, 'function')
assert.equal(typeof compact.toCompact, 'function')
assert.equal(markdown.fromMarkdown('hello').type, 'doc')
const pages = store.createMemoryStore()
await pages.put('p1', { type: 'doc', content: [{ type: 'paragraph' }] }, { expectedRevision: null })
assert.equal((await pages.get('p1')).revision, 1)
await assert.rejects(() => pages.put('p1', { type: 'doc' }, { expectedRevision: null }), store.StaleRevisionError)
const settings = store.createSettingsStore(store.createMemorySettingsStorage())
assert.equal((await settings.get('p1')).aiReview, 'ask')
await settings.set('p1', { locked: true })
assert.equal((await settings.get('p1')).locked, true)
`,
  )
  run(['node.mjs'])
  writeFileSync(
    join(temp, 'editor.mjs'),
    `
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' })
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver', 'DOMParser', 'getComputedStyle', 'localStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'getComputedStyle' ? dom.window[key].bind(dom.window) : dom.window[key] })
}
const { createTestEditor } = await import('${pkg.name}/react')
const { textPlugin } = await import('${pkg.name}/plugins/text')
const { listsPlugin } = await import('${pkg.name}/plugins/lists')
const { createPageEngine, createPagesEngine, createMemoryRequestLog } = await import('${pkg.name}/engine')
const stores = await import('${pkg.name}/store')
const markdown = await import('${pkg.name}/markdown')
const session = createTestEditor({ plugins: [textPlugin(), listsPlugin], content: '<p>Before</p>' })
try {
  const engine = createPageEngine({ editor: session.editor, markdown: {
    parseInline: markdown.parseInline, parseBlocks: text => markdown.fromMarkdown(text).content ?? [], inlineToMarkdown: markdown.inlineToMarkdown,
  } })
  const first = engine.outline()
  const id = first.blocks[0].id
  const request = { baseRevision: first.revision, requestId: 'packed-one', steps: [{ op: 'replaceMarkdown', id, text: '**After**' }] }
  assert.equal(engine.edit(request).ok, true)
  assert(session.editor.getHTML().includes('<strong>After</strong>'))
  assert.equal(engine.edit(request).replayed, true)
  assert.match(engine.readCompact().text, /After/)
  assert.equal(engine.undo().ok, true)
  assert.equal(session.editor.getText(), 'Before')
  const store = stores.createMemoryStore()
  const settings = stores.createSettingsStore(stores.createMemorySettingsStorage())
  const registry = stores.createPageRegistry({ storage: stores.createMemoryRegistryStorage(), pages: store, settings })
  const pages = createPagesEngine({ registry, store, settings, requestLog: createMemoryRequestLog(), markdown: {
    parseInline: markdown.parseInline, parseBlocks: text => markdown.fromMarkdown(text).content ?? [], inlineToMarkdown: markdown.inlineToMarkdown,
  }, createEditor: doc => createTestEditor({ plugins: [textPlugin(), listsPlugin], content: doc ?? '' }) })
  const created = await pages.create({ title: 'Packed page', text: 'Original' })
  assert.equal(created.ok, true)
  const snapshot = await pages.outline(created.id)
  assert.equal(snapshot.ok, true)
  const change = { requestId: 'closed-one', baseRevision: snapshot.revision, steps: [{ op: 'replaceText', id: snapshot.blocks[0].id, text: 'Changed closed page' }] }
  assert.equal((await pages.edit(created.id, change)).ok, true)
  assert.equal((await pages.edit(created.id, change)).replayed, true)
  assert.equal((await store.get(created.id)).doc.content[0].content[0].text, 'Changed closed page')
  assert.equal((await pages.undo(created.id)).ok, true)
  await settings.set(created.id, { locked: true })
  const locked = await pages.edit(created.id, { ...change, requestId: 'closed-two' })
  assert.equal(locked.ok, false)
  assert.equal(locked.errors[0].code, 'locked')

} finally {
  session.destroy()
  dom.window.close()
}
`,
  )
  run(['editor.mjs'])

  writeFileSync(
    join(temp, 'consumer.ts'),
    `
import { composePlugins, type PageControllerOptions, createExtensions, PanelStore, SlashStore } from '${pkg.name}/react'
import { createPageEngine, createPagesEngine, type EditRequest, type PagesEngineOptions } from '${pkg.name}/engine'
import { createMemoryStore, type PageStore } from '${pkg.name}/store'
import { textPlugin } from '${pkg.name}/plugins/text'
import { listsPlugin } from '${pkg.name}/plugins/lists'
import { parseInline, fromMarkdown, inlineToMarkdown } from '${pkg.name}/markdown'
const registry = composePlugins([textPlugin(), listsPlugin])
const extensions = createExtensions(registry, { panels: new PanelStore(), slash: new SlashStore() })
const store: PageStore = createMemoryStore()
const codec = { parseInline, parseBlocks: (text: string) => fromMarkdown(text).content ?? [], inlineToMarkdown }
const options: PageControllerOptions = { registry, documentId: 'p1', initialContent: { type: 'doc' } }
const request: EditRequest = { baseRevision: 'rev', requestId: 'one', steps: [] }
void [extensions, store, codec, options, request, createPageEngine, createPagesEngine]
export type EngineOptions = PagesEngineOptions
`,
  )
  writeFileSync(
    join(temp, 'react-consumer.tsx'),
    `
import { composePlugins, PageEditor, usePageController } from '${pkg.name}/react'
import { textPlugin } from '${pkg.name}/plugins/text'
import { listsPlugin } from '${pkg.name}/plugins/lists'
const registry = composePlugins([textPlugin(), listsPlugin])
const initialContent = { type: 'doc', content: [{ type: 'paragraph' }] }
export function Document() {
  const controller = usePageController({ registry, documentId: 'workspace:page-one', initialContent })
  return <PageEditor page={controller} />
}
`,
  )
  for (const mode of ['NodeNext', 'Bundler']) {
    writeFileSync(
      join(temp, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: mode === 'NodeNext' ? mode : 'ESNext',
          moduleResolution: mode,
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          jsx: 'react-jsx',
          types: ['react', 'react-dom'],
        },
        files: ['consumer.ts', 'react-consumer.tsx'],
      }),
    )
    run(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'])
  }
  writeFileSync(join(temp, 'index.html'), '<div id="app"></div><script type="module" src="/main.ts"></script>')
  writeFileSync(
    join(temp, 'main.ts'),
    `
import { composePlugins } from '${pkg.name}/react'
import { textPlugin } from '${pkg.name}/plugins/text'
import { listsPlugin } from '${pkg.name}/plugins/lists'
import '${pkg.name}/styles.css'
document.querySelector('#app')!.textContent = composePlugins([textPlugin(), listsPlugin]).extensions.length.toString()
`,
  )
  run(['node_modules/vite/bin/vite.js', 'build'])
  assert(existsSync(join(temp, 'dist/index.html')))
  log(
    `Packed consumer passed: ${receipt.entryCount} files, ${receipt.size} bytes packed, Node imports, store checks, NodeNext/Bundler types, browser build.`,
  )
} finally {
  if (process.env.KEEP_PACKAGE_CONSUMER) log(`Consumer retained at ${temp}`)
  else rmSync(temp, { recursive: true, force: true })
}
