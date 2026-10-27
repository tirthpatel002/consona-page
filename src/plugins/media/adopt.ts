import type { Editor } from '@tiptap/core'
import type { BlobStore } from '../../editor/core'
import { MEDIA_NODE } from './extensions'
import { blobRefFor, isBlobRef } from './host'

const idOf = (ref: string): string => ref.slice('blob:'.length)

const refsOf = (editor: Editor): string[] => {
  const found = new Set<string>()
  editor.state.doc.descendants((node) => {
    if (node.type.name === MEDIA_NODE && isBlobRef(node.attrs.blob)) found.add(node.attrs.blob)
  })
  return [...found]
}

/**
 * Keeps stored files with the page that shows them. A block copied from another page still reads its file
 * (reads are by id), but it belongs to the other page. This copies the file into this page's store and points
 * the block at the copy in one follow-up change that is not part of undo history. If the copy cannot be saved
 * the block keeps its original reference and keeps rendering, and a warning says so once.
 */
export function createBlobAdopter(
  editor: Editor,
  blobs: BlobStore,
  pageId: () => string,
  warn: (message: string) => void = (message) => {
    if (typeof window !== 'undefined') window.alert(message)
  },
) {
  const inFlight = new Set<string>()
  const failed = new Set<string>()
  let destroyed = false

  const rewrite = (oldRef: string, newRef: string): number => {
    if (destroyed || editor.isDestroyed) return 0
    const { state } = editor
    const tr = state.tr
    let count = 0
    state.doc.descendants((node, pos) => {
      if (node.type.name === MEDIA_NODE && node.attrs.blob === oldRef) {
        tr.setNodeAttribute(pos, 'blob', newRef)
        count += 1
      }
    })
    if (count === 0) return 0
    tr.setMeta('addToHistory', false)
    tr.setMeta('source', 'program')
    editor.view.dispatch(tr)
    return count
  }

  const adopt = async (oldRef: string, target: string) => {
    try {
      const stored = await blobs.get(idOf(oldRef))
      if (!stored || stored.pageId === target) return
      if (destroyed || pageId() !== target) return
      const copy = await blobs.put(target, stored.blob)
      const newRef = blobRefFor(copy.id)
      // The block may have been deleted or moved while the copy was written: rewrite whatever still carries the reference.
      if (rewrite(oldRef, newRef) === 0) await blobs.remove(copy.id).catch(() => undefined)
    } catch {
      failed.add(oldRef)
      warn(
        'A file in this page could not be saved to this page, so its copy was not saved. It still shows from the original, and saving is tried again when you click back into the page.',
      )
    }
  }

  const scan = async () => {
    if (destroyed || !editor.isEditable) return
    const target = pageId()
    if (!target) return
    for (const ref of refsOf(editor)) {
      if (inFlight.has(ref) || failed.has(ref)) continue
      inFlight.add(ref)
      try {
        const stored = await blobs.get(idOf(ref))
        if (stored && stored.pageId !== target) await adopt(ref, target)
      } catch {
        failed.add(ref)
      } finally {
        inFlight.delete(ref)
      }
    }
  }

  return {
    scan: () => void scan(),
    /** A new attempt for files whose copy failed (focus, unlock, or the user fixing space). */
    retry: () => {
      failed.clear()
      void scan()
    },
    destroy: () => {
      destroyed = true
    },
  }
}
