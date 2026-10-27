import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Storage {
    documentIdentity: { documentId: string }
  }
}

/**
 * The stable identity of the document in this editor, exposed to plugins so their local storage
 * (comments, future per-document state) scopes to the same key the version history uses.
 */
export const documentIdentityExtension = Extension.create<{ documentId: string }>({
  name: 'documentIdentity',

  addOptions() {
    return { documentId: 'default' }
  },

  addStorage() {
    return { documentId: this.options.documentId }
  },
})
