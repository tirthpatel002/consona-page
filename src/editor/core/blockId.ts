import { Extension, type AnyExtension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Mapping } from '@tiptap/pm/transform'

const ATTR = 'blockId'
const VALID_ID = /^[A-Za-z0-9_-]{6,40}$/
const EXCLUDED = new Set(['doc', 'text', 'hardBreak'])
const META = 'blockIdAssign'

/** A fresh id: "b" plus nine random base36 characters. Unique within the document, never reused by this editor. */
export function newBlockId(taken: ReadonlySet<string>): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(9))
    const id = 'b' + Array.from(bytes, (byte) => (byte % 36).toString(36)).join('')
    if (!taken.has(id)) return id
  }
}

export const isBlockId = (value: unknown): value is string => typeof value === 'string' && VALID_ID.test(value)

interface Found {
  readonly node: ProseMirrorNode
  readonly pos: number
}

function collect(doc: ProseMirrorNode): Found[] {
  const found: Found[] = []
  doc.descendants((node, pos) => {
    if (node.type.spec.attrs && ATTR in node.type.spec.attrs) found.push({ node, pos })
  })
  return found
}

/**
 * Gives every block node a unique id. Missing, malformed and duplicate ids get a new one. When the same id
 * appears twice (a copy was pasted), the occurrence that is the original, found by mapping its old position
 * through the transaction, keeps it, so ids survive moves and edits and a pasted copy gets a new id.
 */
export function assignBlockIds(
  state: EditorState,
  tr: Transaction,
  previous?: { readonly doc: ProseMirrorNode; readonly mapping: Mapping },
): boolean {
  const found = collect(tr.doc)
  const byId = new Map<string, Found[]>()
  const taken = new Set<string>()
  for (const item of found) {
    const id: unknown = item.node.attrs[ATTR]
    if (!isBlockId(id)) continue
    taken.add(id)
    byId.set(id, [...(byId.get(id) ?? []), item])
  }
  const originalPos = new Map<string, number>()
  if (previous) {
    for (const item of collect(previous.doc)) {
      const id: unknown = item.node.attrs[ATTR]
      if (isBlockId(id) && !originalPos.has(id)) originalPos.set(id, previous.mapping.map(item.pos))
    }
  }
  let changed = false
  const assign = (pos: number) => {
    const id = newBlockId(taken)
    taken.add(id)
    tr.setNodeAttribute(pos, ATTR, id)
    changed = true
  }
  for (const item of found) {
    const id: unknown = item.node.attrs[ATTR]
    if (!isBlockId(id)) {
      assign(item.pos)
      continue
    }
    const same = byId.get(id) ?? []
    if (same.length < 2) continue
    const wanted = originalPos.get(id)
    const keeper = same.find((s) => s.pos === wanted) ?? same[0]
    if (item !== keeper) assign(item.pos)
  }
  void state
  return changed
}

/** Assigns ids to a freshly loaded document right now. Safe to call more than once. Not undoable. */
export function ensureBlockIds(editor: {
  readonly state: EditorState
  readonly view: { dispatch: (tr: Transaction) => void }
}): boolean {
  const tr = editor.state.tr
  if (!assignBlockIds(editor.state, tr)) return false
  editor.view.dispatch(tr.setMeta(META, true).setMeta('addToHistory', false))
  return true
}

/** Block ids: a stable `blockId` attribute on every block node, assigned on creation and on first load of old pages. */
export const blockIdExtension: AnyExtension = Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    const types = (
      this as unknown as { extensions: readonly { type: string; name: string; config?: { inline?: unknown } }[] }
    ).extensions
      .filter((ext) => ext.type === 'node' && !EXCLUDED.has(ext.name) && !ext.config?.inline)
      .map((ext) => ext.name)
    return [
      {
        types,
        attributes: {
          [ATTR]: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const value = element.getAttribute('data-block-id')
              return isBlockId(value) ? value : null
            },
            renderHTML: (attributes: Record<string, unknown>) =>
              isBlockId(attributes[ATTR]) ? { 'data-block-id': attributes[ATTR] } : {},
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockId'),
        appendTransaction: (transactions, oldState, newState) => {
          if (!transactions.some((t) => t.docChanged)) return null
          const mapping = new Mapping()
          for (const t of transactions) mapping.appendMapping(t.mapping)
          const tr = newState.tr
          if (!assignBlockIds(newState, tr, { doc: oldState.doc, mapping })) return null
          return tr.setMeta(META, true).setMeta('addToHistory', false)
        },
      }),
    ]
  },

  onCreate() {
    // Pages saved before block ids existed get them on first load. Not undoable; the autosave stores them.
    ensureBlockIds(this.editor)
  },
})
