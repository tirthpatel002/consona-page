import type { CommentMessage } from './types'

export interface CommentMessageNode {
  readonly message: CommentMessage
  readonly children: readonly CommentMessageNode[]
}

/** Top-level messages first, then nested replies in creation order. */
export const buildMessageForest = (messages: readonly CommentMessage[]): CommentMessageNode[] => {
  const byId = new Map(messages.map((message) => [message.id, message]))
  const buckets = new Map<string | null, CommentMessage[]>()
  const bucket = (key: string | null): CommentMessage[] => {
    const existing = buckets.get(key)
    if (existing) return existing
    const next: CommentMessage[] = []
    buckets.set(key, next)
    return next
  }
  for (const message of messages) {
    const parentId = message.parentId
    if (parentId && byId.has(parentId)) bucket(parentId).push(message)
    else bucket(null).push(message)
  }
  const sort = (list: CommentMessage[]): CommentMessage[] => [...list].sort((a, b) => a.createdAt - b.createdAt)
  const build = (parentId: string | null): CommentMessageNode[] =>
    sort(bucket(parentId)).map((message) => ({
      message,
      children: build(message.id),
    }))
  return build(null)
}

/** Message id plus all nested replies (depth-first). */
export const countReplyTree = (nodes: readonly CommentMessageNode[]): number => {
  let total = 0
  for (const node of nodes) {
    total += 1 + countReplyTree(node.children)
  }
  return total
}

/** Parent message ids from `messageId` up to the thread root (for expanding collapsed branches). */
export const ancestorMessageIds = (messages: readonly CommentMessage[], messageId: string): string[] => {
  const byId = new Map(messages.map((message) => [message.id, message]))
  const ids: string[] = []
  let current = byId.get(messageId)
  while (current?.parentId) {
    ids.push(current.parentId)
    current = byId.get(current.parentId)
  }
  return ids
}

export const collectDescendantIds = (messages: readonly CommentMessage[], rootId: string): Set<string> => {
  const byParent = new Map<string, CommentMessage[]>()
  for (const message of messages) {
    if (!message.parentId) continue
    const list = byParent.get(message.parentId) ?? []
    list.push(message)
    byParent.set(message.parentId, list)
  }
  const ids = new Set<string>([rootId])
  const stack = [rootId]
  while (stack.length > 0) {
    const id = stack.pop()
    if (!id) continue
    for (const child of byParent.get(id) ?? []) {
      ids.add(child.id)
      stack.push(child.id)
    }
  }
  return ids
}
