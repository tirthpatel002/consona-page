import type { JSONContent } from '@tiptap/core'

export interface WordDiff {
  readonly text: string
  readonly kind: 'same' | 'added' | 'removed'
}

export interface BlockDiff {
  readonly kind: 'same' | 'added' | 'removed' | 'changed'
  readonly before?: JSONContent
  readonly after?: JSONContent
  /** Word-level inline changes for 'changed' pairs. */
  readonly words?: readonly WordDiff[]
  /** Set when the pair changed without text changes (marks, attrs, embed props). */
  readonly note?: string
}

const textOf = (node: JSONContent | undefined): string => {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(textOf).join('')
}

/** All marks in a node's subtree, so formatting-only changes are caught (bold, link, comment...). */
const marksOf = (node: JSONContent | undefined): unknown[] => {
  if (!node) return []
  const own =
    node.type === 'text' ? (node.marks ?? []).map((mark) => ({ type: mark.type, attrs: mark.attrs ?? {} })) : []
  return [...own, ...(node.content ?? []).flatMap(marksOf)]
}

const signature = (node: JSONContent): string =>
  `${node.type}:${JSON.stringify(node.attrs ?? {})}:${JSON.stringify(marksOf(node))}:${textOf(node)}`

/** Why a same-text pair still differs: block attrs (callout variant, checked...), marks, or both. */
const describeNonTextChange = (before: JSONContent, after: JSONContent): string => {
  const attrsChanged = JSON.stringify(before.attrs ?? {}) !== JSON.stringify(after.attrs ?? {})
  const marksChanged = JSON.stringify(marksOf(before)) !== JSON.stringify(marksOf(after))
  if (attrsChanged && marksChanged) return 'formatting and properties changed'
  if (marksChanged) return 'formatting changed'
  if (attrsChanged) return 'properties changed'
  return 'content changed'
}

/** Longest common subsequence of word tokens (blocks are small; O(n*m) is fine). */
const lcs = <T>(a: readonly T[], b: readonly T[], eq: (x: T, y: T) => boolean): boolean[][] => {
  const table: boolean[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(false))
  const len: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i -= 1)
    for (let j = b.length - 1; j >= 0; j -= 1) {
      if (eq(a[i], b[j])) len[i][j] = len[i + 1][j + 1] + 1
      else len[i][j] = Math.max(len[i + 1][j], len[i][j + 1])
    }
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (eq(a[i], b[j])) {
      table[i][j] = true
      i += 1
      j += 1
    } else if (len[i + 1][j] >= len[i][j + 1]) i += 1
    else j += 1
  }
  return table
}

/** Word-level diff between two texts: added/removed/same runs, whitespace preserved. */
export const diffWords = (before: string, after: string): readonly WordDiff[] => {
  const tokenize = (text: string) => text.split(/(\s+)/).filter((part) => part.length > 0)
  const a = tokenize(before)
  const b = tokenize(after)
  const table = lcs(a, b, (x, y) => x === y)
  const out: WordDiff[] = []
  const push = (text: string, kind: WordDiff['kind']) => {
    const last = out[out.length - 1]
    if (last && last.kind === kind) out[out.length - 1] = { text: last.text + text, kind }
    else out.push({ text, kind })
  }
  const usedA = new Set<number>()
  const usedB = new Set<number>()
  for (let i = 0; i < a.length; i += 1)
    for (let j = 0; j < b.length; j += 1)
      if (table[i][j]) {
        usedA.add(i)
        usedB.add(j)
      }
  // Interleave in document order: matched pairs anchor, unmatched a = removed, b = added.
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    const aMatched = i < a.length && usedA.has(i)
    const bMatched = j < b.length && usedB.has(j)
    if (aMatched && bMatched) {
      push(a[i], 'same')
      i += 1
      j += 1
    } else if (!aMatched && i < a.length && (j >= b.length || !usedB.has(j) || true)) {
      // Emit removals before the next anchor, then additions at the same point.
      if (i < a.length && !usedA.has(i)) {
        push(a[i], 'removed')
        i += 1
      } else if (j < b.length && !usedB.has(j)) {
        push(b[j], 'added')
        j += 1
      } else {
        i += 1
      }
    } else if (j < b.length && !usedB.has(j)) {
      push(b[j], 'added')
      j += 1
    } else {
      i += 1
    }
  }
  return out
}

/**
 * Structured diff between two documents (E1): top-level blocks matched by LCS over exact
 * signatures (type + attrs + text, so custom embeds diff too). Adjacent removed/added pairs of
 * the same node type become 'changed' entries with a word-level inline diff.
 */
export const diffDocs = (before: JSONContent, after: JSONContent): readonly BlockDiff[] => {
  const a = before.content ?? []
  const b = after.content ?? []
  const sigA = a.map(signature)
  const sigB = b.map(signature)
  // LCS lengths.
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i -= 1)
    for (let j = b.length - 1; j >= 0; j -= 1)
      dp[i][j] = sigA[i] === sigB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  // Backtrack into a raw op list.
  const raw: BlockDiff[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && sigA[i] === sigB[j]) {
      raw.push({ kind: 'same', before: a[i], after: b[j] })
      i += 1
      j += 1
    } else if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) {
      raw.push({ kind: 'added', after: b[j] })
      j += 1
    } else {
      raw.push({ kind: 'removed', before: a[i] })
      i += 1
    }
  }
  // Within each run of added/removed ops, pair same-type entries into 'changed' (order kept).
  const out: BlockDiff[] = []
  let k = 0
  while (k < raw.length) {
    if (raw[k].kind === 'same') {
      out.push(raw[k])
      k += 1
      continue
    }
    const run: BlockDiff[] = []
    while (k < raw.length && raw[k].kind !== 'same') {
      run.push(raw[k])
      k += 1
    }
    const used = new Set<number>()
    for (let x = 0; x < run.length; x += 1) {
      if (used.has(x) || run[x].kind !== 'removed') continue
      const pair = run.findIndex(
        (entry, y) => y !== x && !used.has(y) && entry.kind === 'added' && entry.after?.type === run[x].before?.type,
      )
      if (pair >= 0) {
        used.add(x)
        used.add(pair)
        const beforeText = textOf(run[x].before)
        const afterText = textOf(run[pair].after)
        out.push({
          kind: 'changed',
          before: run[x].before,
          after: run[pair].after,
          ...(beforeText !== afterText
            ? { words: diffWords(beforeText, afterText) }
            : { note: describeNonTextChange(run[x].before ?? {}, run[pair].after ?? {}) }),
        })
      }
    }
    for (let x = 0; x < run.length; x += 1) if (!used.has(x)) out.push(run[x])
  }
  return out
}
