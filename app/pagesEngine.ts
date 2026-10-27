import {
  createTestEditor,
  type JsonObject,
  type PageListRegistry,
  type PageSettingsStore,
  type PageStore,
} from '../src/editor/core'
import {
  createLocalStorageRequestLog,
  createPagesEngine,
  type MarkdownCodec,
  type PagesEngine,
  type RequestLog,
} from '../src/editor/engine'
import { fromMarkdown, inlineToMarkdown, parseInline } from '../src/plugins/export/markdown'
import { demoPages, demoRegistry, demoSettings } from './demoSession'
import { pagePlugins } from './plugins'

/** The export plugin's Markdown converter, in the shape the engine takes. */
export const demoMarkdown: MarkdownCodec = {
  parseInline: (text) => parseInline(text),
  parseBlocks: (text) => fromMarkdown(text).content ?? [],
  inlineToMarkdown: (content) => inlineToMarkdown(content),
}

/**
 * Plugins for the detached editors the engine uses on closed pages. The persistence plugin is left out: a
 * detached editor must never save on its own, the engine writes once, with a revision check.
 */
export const detachedPlugins = pagePlugins.filter((plugin) => plugin.id !== 'persistence')

export function createDemoPagesEngine(deps: {
  readonly registry: PageListRegistry
  readonly store: PageStore
  readonly settings: PageSettingsStore
  readonly requestLog?: RequestLog
}): PagesEngine {
  return createPagesEngine({
    ...deps,
    markdown: demoMarkdown,
    createEditor: (doc: JsonObject | null) => {
      const { editor, destroy } = createTestEditor({ plugins: detachedPlugins, content: doc ?? '' })
      return { editor, destroy }
    },
  })
}

/** The one engine the demo app shares: the demo's page list, bodies and settings, with the request log kept in this browser. */
export const demoPagesEngine: PagesEngine = createDemoPagesEngine({
  registry: demoRegistry,
  store: demoPages,
  settings: demoSettings,
  requestLog: createLocalStorageRequestLog(),
})
