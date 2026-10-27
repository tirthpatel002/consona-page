import type { Editor } from '@tiptap/core'
import { Fragment, type Node as PMNode } from '@tiptap/pm/model'
import { isBlockId } from '../core'

/** Every block addressed by the engine has a `blockId` (see core/blockId.ts). */
export interface OutlineEntry {
  readonly id: string
  readonly type: string
  /** Nesting depth below the page (0 = top level). */
  readonly depth: number
  /** First characters of the block's own text, never more than `maxChars`. */
  readonly text: string
}

export interface Outline {
  readonly revision: string
  readonly blocks: readonly OutlineEntry[]
}

export interface BlockText {
  readonly id: string
  readonly type: string
  readonly text: string
  /** True when `text` was cut at `maxChars`. */
  readonly truncated: boolean
}

export interface FoundBlock {
  readonly id: string
  readonly type: string
  readonly excerpt: string
}

export type Step =
  /** Replaces the text of a text block, or of the single text block inside a list item or table cell. Plain text: marks in the old text are dropped. */
  | { readonly op: 'replaceText'; readonly id: string; readonly text: string }
  /** Adds a plain paragraph after the block `id` (a top-level block, or a block inside a container that accepts paragraphs there). */
  | { readonly op: 'insertParagraphAfter'; readonly id: string; readonly text: string }
  | { readonly op: 'delete'; readonly id: string }

export interface EditRequest {
  /** Revision the caller read. The edit is refused if a block it touches changed since. */
  readonly baseRevision: string
  /** Same id sent twice returns the first result and changes nothing the second time. */
  readonly requestId: string
  readonly steps: readonly Step[]
}

export type EditErrorCode =
  | 'locked'
  | 'unknown_revision'
  | 'stale'
  | 'unknown_block'
  | 'not_text_target'
  | 'not_allowed'
  | 'invalid_step'
  | 'too_large'

export interface EditError {
  readonly code: EditErrorCode
  /** Index of the failing step, when one step caused it. */
  readonly step?: number
  readonly id?: string
  readonly message: string
  /** For `stale`: ids of blocks that changed (or were removed) since `baseRevision`. */
  readonly changed?: readonly string[]
}

export type EditResult =
  | { readonly ok: true; readonly revision: string; readonly applied: number; readonly replayed: boolean }
  | { readonly ok: false; readonly errors: readonly EditError[] }

export interface PageEngineOptions {
  readonly editor: Editor
  /** Longest text one step may write. Default 20 000 characters. */
  readonly maxTextChars?: number
  /** How many past revisions are remembered for stale checks. Default 20. */
  readonly keepRevisions?: number
}

export interface PageEngine {
  outline(options?: { readonly maxChars?: number }): Outline
  read(ids: readonly string[], options?: { readonly maxChars?: number }): readonly BlockText[]
  find(query: string, options?: { readonly limit?: number }): readonly FoundBlock[]
  edit(request: EditRequest): EditResult
  /** Current revision of the open page. */
  revision(): string
}

interface BlockInfo {
  readonly node: PMNode
  readonly pos: number
  readonly depth: number
}

/** Own text of a block: its direct inline content, or for a container the text of its first textblock. */
const ownText = (node: PMNode): string => {
  if (node.isTextblock) return node.textContent
  let text = ''
  node.forEach((child) => {
    if (!text && child.isTextblock) text = child.textContent
  })
  return text
}

const hash = (value: string): string => {
  let h = 5381
  for (let i = 0; i < value.length; i += 1) h = ((h << 5) + h + value.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const blockId = (node: PMNode): string | null => (isBlockId(node.attrs.blockId) ? (node.attrs.blockId as string) : null)

/** Everything with a blockId, in document order. */
function blocksOf(doc: PMNode): Map<string, BlockInfo> {
  const map = new Map<string, BlockInfo>()
  doc.descendants((node, pos) => {
    const id = blockId(node)
    if (id !== null && !map.has(id)) map.set(id, { node, pos, depth: doc.resolve(pos).depth })
    return true
  })
  return map
}

/** Fingerprint of one block: its type and full content, so any change to it (or inside it) shows. */
const fingerprint = (node: PMNode): string => hash(node.type.name + JSON.stringify(node.toJSON()))

const revisionOf = (doc: PMNode): string => 'r' + hash(JSON.stringify(doc.toJSON()))

/**
 * A headless handle on one open page. It reads bounded views of the page and applies batches of small
 * steps through the same editor, schema and history as a user edit.
 *
 * Rules: a batch is validated as a whole and applied as one transaction (one undo step) or not at all;
 * blocks the batch does not touch keep their ids and content; the edit carries the revision the caller
 * read, and is refused only when a block it touches has changed since; a repeated request id is a replay.
 * There is no raw JSON write method.
 */
export function createPageEngine(options: PageEngineOptions): PageEngine {
  const { editor, maxTextChars = 20_000, keepRevisions = 20 } = options
  const snapshots = new Map<string, ReadonlyMap<string, string>>()
  const results = new Map<string, EditResult>()

  const snapshot = (doc: PMNode): string => {
    const revision = revisionOf(doc)
    if (!snapshots.has(revision)) {
      snapshots.set(revision, new Map([...blocksOf(doc)].map(([id, info]) => [id, fingerprint(info.node)])))
      while (snapshots.size > keepRevisions) {
        const oldest = snapshots.keys().next().value
        if (oldest === undefined) break
        snapshots.delete(oldest)
      }
    }
    return revision
  }
  const cut = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text)

  const fail = (...errors: EditError[]): EditResult => ({ ok: false, errors })

  return {
    revision: () => snapshot(editor.state.doc),

    outline({ maxChars = 80 } = {}) {
      const doc = editor.state.doc
      const revision = snapshot(doc)
      const blocks = [...blocksOf(doc)].map(([id, info]) => ({
        id,
        type: info.node.type.name,
        depth: info.depth,
        text: cut(ownText(info.node), maxChars),
      }))
      return { revision, blocks }
    },

    read(ids, { maxChars = 2_000 } = {}) {
      const known = blocksOf(editor.state.doc)
      const out: BlockText[] = []
      for (const id of ids) {
        const info = known.get(id)
        if (!info) continue
        const full = info.node.textContent
        out.push({ id, type: info.node.type.name, text: cut(full, maxChars), truncated: full.length > maxChars })
      }
      return out
    },

    find(query, { limit = 20 } = {}) {
      const needle = query.trim().toLowerCase()
      if (!needle) return []
      const out: FoundBlock[] = []
      for (const [id, info] of blocksOf(editor.state.doc)) {
        // Only blocks whose own text matches, so a container does not repeat what its children report.
        if (!info.node.isTextblock) continue
        const text = info.node.textContent
        const at = text.toLowerCase().indexOf(needle)
        if (at < 0) continue
        out.push({
          id,
          type: info.node.type.name,
          excerpt: text.slice(Math.max(0, at - 30), at + needle.length + 30),
        })
        if (out.length >= limit) break
      }
      return out
    },

    edit(request) {
      const replay = results.get(request.requestId)
      if (replay) return replay.ok ? { ...replay, replayed: true } : replay
      const finish = (result: EditResult): EditResult => {
        results.set(request.requestId, result)
        return result
      }
      if (!editor.isEditable) {
        return fail({ code: 'locked', message: 'The page is locked, so the engine cannot change it.' })
      }
      const doc = editor.state.doc
      const base = snapshots.get(request.baseRevision)
      if (!base) {
        return fail({
          code: 'unknown_revision',
          message: 'That revision is not known (too old, or from another page). Read the outline again.',
        })
      }
      const current = blocksOf(doc)
      const errors: EditError[] = []
      const touched = new Set<string>()
      request.steps.forEach((step, index) => {
        if (typeof step.id !== 'string' || !current.has(step.id)) {
          errors.push({
            code: 'unknown_block',
            step: index,
            id: step.id,
            message: `No block with id "${String(step.id)}" on this page.`,
          })
          return
        }
        touched.add(step.id)
      })
      // Blocks the batch touches must be unchanged since the revision the caller read.
      const changed = [...touched].filter((id) => {
        const before = base.get(id)
        const now = current.get(id)
        return before !== undefined && now !== undefined && before !== fingerprint(now.node)
      })
      if (changed.length > 0 && errors.length === 0) {
        return fail({
          code: 'stale',
          message: 'A block this edit touches changed after it was read.',
          changed,
        })
      }
      if (errors.length > 0) return fail(...errors)
      if (request.steps.length === 0) {
        return finish({ ok: true, revision: snapshot(doc), applied: 0, replayed: false })
      }

      // Apply every step to one transaction, always addressing blocks by id so earlier steps cannot shift later ones.
      const tr = editor.state.tr
      const schema = editor.schema
      for (const [index, step] of request.steps.entries()) {
        const live = blocksOf(tr.doc).get(step.id)
        if (!live) {
          return fail({
            code: 'unknown_block',
            step: index,
            id: step.id,
            message: 'An earlier step in this batch removed this block.',
          })
        }
        if (step.op !== 'delete' && (typeof step.text !== 'string' || step.text.length > maxTextChars)) {
          return fail({
            code: typeof step.text === 'string' ? 'too_large' : 'invalid_step',
            step: index,
            id: step.id,
            message: 'Step text must be a string of at most ' + String(maxTextChars) + ' characters.',
          })
        }
        if (step.op === 'replaceText') {
          const target = live.node.isTextblock
            ? { node: live.node, pos: live.pos }
            : textblockInside(live.node, live.pos)
          if (!target) {
            return fail({
              code: 'not_text_target',
              step: index,
              id: step.id,
              message: 'This block has no single text block to replace.',
            })
          }
          const from = target.pos + 1
          const to = target.pos + target.node.nodeSize - 1
          if (step.text === '') tr.delete(from, to)
          else tr.replaceWith(from, to, schema.text(step.text))
        } else if (step.op === 'insertParagraphAfter') {
          const paragraph = schema.nodes.paragraph
          const after = live.pos + live.node.nodeSize
          const parent = tr.doc.resolve(live.pos).parent
          const index2 = tr.doc.resolve(after).index()
          if (!paragraph || !parent.canReplaceWith(index2, index2, paragraph)) {
            return fail({
              code: 'not_allowed',
              step: index,
              id: step.id,
              message: 'A paragraph cannot go after this block.',
            })
          }
          tr.insert(after, paragraph.create(null, step.text ? schema.text(step.text) : undefined))
        } else if (step.op === 'delete') {
          const parent = tr.doc.resolve(live.pos).parent
          const at = tr.doc.resolve(live.pos).index()
          const rest = Fragment.fromArray(
            Array.from({ length: parent.childCount }, (_, i) => parent.child(i)).filter((_, i) => i !== at),
          )
          if (!parent.type.validContent(rest)) {
            return fail({
              code: 'not_allowed',
              step: index,
              id: step.id,
              message: 'This block cannot be deleted without leaving its parent invalid.',
            })
          }
          tr.delete(live.pos, live.pos + live.node.nodeSize)
        } else {
          return fail({ code: 'invalid_step', step: index, message: 'Unknown step.' })
        }
      }
      if (!tr.docChanged) return finish({ ok: true, revision: snapshot(doc), applied: 0, replayed: false })
      tr.setMeta('source', 'program')
      editor.view.dispatch(tr)
      return finish({ ok: true, revision: snapshot(editor.state.doc), applied: request.steps.length, replayed: false })
    },
  }
}

function textblockInside(node: PMNode, pos: number): { node: PMNode; pos: number } | null {
  let found: { node: PMNode; pos: number } | null = null
  let count = 0
  node.forEach((child, offset) => {
    if (child.isTextblock) {
      count += 1
      found = { node: child, pos: pos + 1 + offset }
    }
  })
  return count === 1 ? found : null
}
