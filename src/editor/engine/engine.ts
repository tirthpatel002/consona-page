import type { Editor } from '@tiptap/core'
import { Fragment, Slice, type Node as PMNode } from '@tiptap/pm/model'
import { ReplaceStep } from '@tiptap/pm/transform'
import { isBlockId, isSafeUrl } from '../core'
import { toCompact, type CompactOptions, type CompactText, type JsonNode, type MarkdownCodec } from './compact'

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
  /** Sets plain attributes (a callout's variant, a code block's language, a task's checked state) on a block that is not a file, embed or link. Values are strings, numbers, booleans or null, of the same kind as the attribute's default. */
  | {
      readonly op: 'setProps'
      readonly id: string
      readonly props: Readonly<Record<string, string | number | boolean | null>>
    }
  /** Adds a plain paragraph after the block `id` (a top-level block, or a block inside a container that accepts paragraphs there). */
  | { readonly op: 'insertParagraphAfter'; readonly id: string; readonly text: string }
  | { readonly op: 'delete'; readonly id: string }
  /** Moves the block `id` (with its content and ids) to directly after the block `after`. Refused when the new place cannot hold it, or `after` is inside `id`. */
  | { readonly op: 'moveAfter'; readonly id: string; readonly after: string }
  /** Replaces the text of a text block (or a container's single text block) from inline Markdown, keeping bold, italic, links and the like. Needs `markdown` in the options. Links are checked against the URL allowlist. */
  | { readonly op: 'replaceMarkdown'; readonly id: string; readonly text: string }
  /** Adds the blocks of a Markdown text after the block `id`: paragraphs, headings, lists, quotes, code, rules and tables only. Needs `markdown` in the options. */
  | { readonly op: 'insertMarkdownAfter'; readonly id: string; readonly text: string }

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
  | 'cycle'
  | 'invalid_step'
  | 'too_large'
  | 'blocked_url'
  | 'nothing_to_undo'
  | 'changed_since'
  | 'needs_markdown'

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
  /** Markdown converter, needed for `replaceMarkdown`, `insertMarkdownAfter` and `readCompact`. */
  readonly markdown?: MarkdownCodec
  /** Most blocks one `insertMarkdownAfter` may add. Default 200. */
  readonly maxInsertBlocks?: number
}

export interface PageEngine {
  outline(options?: { readonly maxChars?: number }): Outline
  read(ids: readonly string[], options?: { readonly maxChars?: number }): readonly BlockText[]
  find(query: string, options?: { readonly limit?: number }): readonly FoundBlock[]
  edit(request: EditRequest): EditResult
  /** Current revision of the open page. */
  revision(): string
  /** Steps back the last batch this handle applied, as one program change. Refused if anything changed the page since. */
  undo(): EditResult
  /** Compact id-addressed text of the page (or of the named blocks). Needs `markdown` in the options; returns null without it. */
  readCompact(
    options?: Omit<CompactOptions, 'ids'> & { readonly ids?: readonly string[] },
  ): (CompactText & { readonly revision: string }) | null
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
  const { editor, maxTextChars = 20_000, keepRevisions = 20, markdown, maxInsertBlocks = 200 } = options
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
  /** The page just before and just after the last applied batch. Undo only runs while the page is still the "after" one. */
  let lastBatch: { before: PMNode; after: PMNode } | null = null

  return {
    revision: () => snapshot(editor.state.doc),

    undo() {
      if (!editor.isEditable)
        return fail({ code: 'locked', message: 'The page is locked, so the engine cannot change it.' })
      if (!lastBatch) return fail({ code: 'nothing_to_undo', message: 'This handle has no applied batch to undo.' })
      if (!editor.state.doc.eq(lastBatch.after)) {
        return fail({
          code: 'changed_since',
          message: 'The page changed after that batch, so it cannot be undone without losing those changes.',
        })
      }
      const { before } = lastBatch
      const tr = editor.state.tr
      tr.step(new ReplaceStep(0, tr.doc.content.size, new Slice(before.content, 0, 0)))
      tr.setMeta('source', 'program')
      editor.view.dispatch(tr)
      lastBatch = null
      return { ok: true, revision: snapshot(editor.state.doc), applied: 1, replayed: false }
    },

    readCompact(compactOptions = {}) {
      if (!markdown) return null
      const doc = editor.state.doc
      const revision = snapshot(doc)
      const { ids, ...rest } = compactOptions
      return { ...toCompact(doc, markdown, { ...rest, ...(ids ? { ids: new Set(ids) } : {}) }), revision }
    },

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
      snapshot(doc) // the current revision is always a valid base, even for a handle that has only just been made
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
        if (step.op === 'moveAfter') {
          if (typeof step.after !== 'string' || !current.has(step.after)) {
            errors.push({
              code: 'unknown_block',
              step: index,
              id: step.after,
              message: `No block with id "${String(step.after)}" on this page.`,
            })
          } else touched.add(step.after)
        }
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
        if (
          (step.op === 'replaceText' ||
            step.op === 'insertParagraphAfter' ||
            step.op === 'replaceMarkdown' ||
            step.op === 'insertMarkdownAfter') &&
          (typeof step.text !== 'string' || step.text.length > maxTextChars)
        ) {
          return fail({
            code: typeof step.text === 'string' ? 'too_large' : 'invalid_step',
            step: index,
            id: step.id,
            message: 'Step text must be a string of at most ' + String(maxTextChars) + ' characters.',
          })
        }
        if (step.op === 'replaceMarkdown' || step.op === 'insertMarkdownAfter') {
          if (!markdown) {
            return fail({
              code: 'needs_markdown',
              step: index,
              id: step.id,
              message: 'This engine was created without a Markdown converter.',
            })
          }
          if (step.op === 'replaceMarkdown') {
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
            const raw = target.node.type.spec.code
              ? [{ type: 'text', text: step.text }]
              : markdown.parseInline(step.text)
            if (hasUnsafeLink(raw)) {
              return fail({
                code: 'blocked_url',
                step: index,
                id: step.id,
                message: 'A link in this text is not allowed.',
              })
            }
            try {
              const nodes = raw.map((n) =>
                n.type === 'hardBreak' ? schema.nodes.hardBreak?.create() : schema.nodeFromJSON(n),
              )
              const fragment = Fragment.fromArray(nodes.filter((n): n is PMNode => n !== undefined))
              if (!target.node.type.validContent(fragment)) throw new Error('invalid')
              const from = target.pos + 1
              const to = target.pos + target.node.nodeSize - 1
              tr.step(new ReplaceStep(from, to, new Slice(fragment, 0, 0)))
              tr.doc.check()
            } catch {
              return fail({
                code: 'invalid_step',
                step: index,
                id: step.id,
                message: 'This text cannot go in that block.',
              })
            }
          } else {
            const blocks = markdown.parseBlocks(step.text)
            if (blocks.length === 0 || blocks.length > maxInsertBlocks) {
              return fail({
                code: blocks.length === 0 ? 'invalid_step' : 'too_large',
                step: index,
                id: step.id,
                message: 'The text must hold between 1 and ' + String(maxInsertBlocks) + ' blocks.',
              })
            }
            if (hasUnsafeLink(blocks) || !blocks.every(allowedInserted)) {
              return fail({
                code: blocks.every(allowedInserted) ? 'blocked_url' : 'not_allowed',
                step: index,
                id: step.id,
                message: blocks.every(allowedInserted)
                  ? 'A link in this text is not allowed.'
                  : 'Only paragraphs, headings, lists, quotes, code, rules and tables can be inserted from text.',
              })
            }
            const after = live.pos + live.node.nodeSize
            try {
              const nodes = blocks.map((b) => schema.nodeFromJSON(stripIds(b)))
              nodes.forEach((n) => n.check())
              tr.step(new ReplaceStep(after, after, new Slice(Fragment.fromArray(nodes), 0, 0)))
              tr.doc.check()
            } catch {
              return fail({
                code: 'not_allowed',
                step: index,
                id: step.id,
                message: 'Those blocks cannot go after this block.',
              })
            }
          }
        } else if (step.op === 'setProps') {
          const problem = propsProblem(live.node, step.props)
          if (problem) return fail({ code: problem.code, step: index, id: step.id, message: problem.message })
          const attrs = { ...live.node.attrs, ...step.props }
          try {
            tr.setNodeMarkup(live.pos, null, attrs)
            tr.doc.check()
          } catch {
            return fail({
              code: 'invalid_step',
              step: index,
              id: step.id,
              message: 'Those properties cannot be set on this block.',
            })
          }
        } else if (step.op === 'replaceText') {
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
        } else if (step.op === 'moveAfter') {
          const target = blocksOf(tr.doc).get(step.after)
          if (!target) {
            return fail({
              code: 'unknown_block',
              step: index,
              id: step.after,
              message: 'An earlier step removed the target block.',
            })
          }
          if (step.after === step.id || (target.pos >= live.pos && target.pos < live.pos + live.node.nodeSize)) {
            return fail({ code: 'cycle', step: index, id: step.id, message: 'A block cannot be moved into itself.' })
          }
          const size = live.node.nodeSize
          const targetEnd = target.pos + target.node.nodeSize
          tr.delete(live.pos, live.pos + size)
          const insertAt = targetEnd > live.pos ? targetEnd - size : targetEnd
          try {
            // A raw ReplaceStep: `tr.insert` would try to fit the node by wrapping it, changing its type.
            tr.step(new ReplaceStep(insertAt, insertAt, new Slice(Fragment.from(live.node), 0, 0)))
            tr.doc.check()
          } catch {
            return fail({
              code: 'not_allowed',
              step: index,
              id: step.id,
              message: 'The block cannot go there, or leaving its old place would make that invalid.',
            })
          }
        } else {
          return fail({ code: 'invalid_step', step: index, message: 'Unknown step.' })
        }
      }
      if (!tr.docChanged) return finish({ ok: true, revision: snapshot(doc), applied: 0, replayed: false })
      tr.setMeta('source', 'program')
      const beforeDoc = editor.state.doc
      editor.view.dispatch(tr)
      lastBatch = { before: beforeDoc, after: editor.state.doc }
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

const BLOCKED_PROP_KEY = /src|href|url|blob|link|html|script/i
const MAX_PROP_CHARS = 200

/** Why `props` cannot be set on `node`, or null. Only known attributes, plain values, nothing that holds a URL or a file. */
function propsProblem(
  node: PMNode,
  props: unknown,
): { code: 'invalid_step' | 'not_allowed' | 'blocked_url' | 'too_large'; message: string } | null {
  if (typeof props !== 'object' || props === null || Array.isArray(props) || Object.keys(props).length === 0) {
    return { code: 'invalid_step', message: 'props must be an object with at least one attribute.' }
  }
  if (node.type.name === 'media' || node.isText) {
    return { code: 'not_allowed', message: 'Files and embeds are changed with the media tools, not here.' }
  }
  const known = node.type.spec.attrs ?? {}
  for (const [key, value] of Object.entries(props)) {
    if (key === 'blockId' || !(key in known)) {
      return { code: 'not_allowed', message: `"${key}" is not an attribute this block can take.` }
    }
    if (BLOCKED_PROP_KEY.test(key)) {
      return { code: 'blocked_url', message: `"${key}" can hold a URL or file and cannot be set here.` }
    }
    const kind = typeof value
    if (value !== null && kind !== 'string' && kind !== 'number' && kind !== 'boolean') {
      return { code: 'invalid_step', message: `"${key}" must be a string, number, boolean or null.` }
    }
    if (typeof value === 'string' && value.length > MAX_PROP_CHARS) {
      return { code: 'too_large', message: `"${key}" is longer than ${String(MAX_PROP_CHARS)} characters.` }
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return { code: 'invalid_step', message: `"${key}" must be a finite number.` }
    }
    if (
      node.type.name === 'heading' &&
      key === 'level' &&
      !(Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 6)
    ) {
      return { code: 'invalid_step', message: 'A heading level is a whole number from 1 to 6.' }
    }
    const fallback = (known[key] as { default?: unknown }).default
    if (value !== null && fallback !== null && fallback !== undefined && typeof fallback !== kind) {
      return { code: 'invalid_step', message: `"${key}" must be a ${typeof fallback}.` }
    }
  }
  return null
}

const INSERTABLE: ReadonlySet<string> = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'table',
])
const allowedInserted = (node: JsonNode): boolean => INSERTABLE.has(node.type)

/** True when any link mark in the tree has a URL the editor would not keep. */
function hasUnsafeLink(nodes: readonly JsonNode[]): boolean {
  return nodes.some(
    (node) =>
      (node.marks ?? []).some((mark) => mark.type === 'link' && !isSafeUrl(String(mark.attrs?.href ?? ''))) ||
      hasUnsafeLink(node.content ?? []),
  )
}

/** Parsed text never brings its own ids; the editor assigns fresh ones. */
function stripIds(node: JsonNode): JsonNode {
  const { blockId: _drop, ...attrs } = (node.attrs ?? {}) as Record<string, unknown>
  void _drop
  return {
    ...node,
    ...(node.attrs ? { attrs } : {}),
    ...(node.content ? { content: node.content.map(stripIds) } : {}),
  }
}
