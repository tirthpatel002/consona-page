import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { createElement } from 'react'
import { isJsonObject, type JsonObject } from '../json'
import { BLOCK_NODE_NAME, type BlockNodeOptions, type BlockNodeStorage } from './blockNodeOptions'
import { BlockView } from './BlockView'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embedBlock: {
      /** Inserts a registered block at the selection. Uses the block's template when props are omitted. */
      insertBlock: (blockType: string, props?: JsonObject) => ReturnType
      /** Replaces the props of the block at `pos` (one undoable transaction). */
      updateBlockProps: (pos: number, props: JsonObject) => ReturnType
    }
  }
  interface Storage {
    embedBlock: BlockNodeStorage
  }
}

function parsePropsAttribute(element: HTMLElement): JsonObject {
  try {
    const value: unknown = JSON.parse(element.getAttribute('data-props') ?? '{}')
    return isJsonObject(value) ? value : {}
  } catch {
    return {}
  }
}

/**
 * The single atom node that hosts every block type. Attrs: { blockType, props }.
 * Selection, copy/paste and drag (from the gutter handle) treat it as one unit; the rendered
 * component owns events inside its body (stopEvent) and its own DOM (ignoreMutation).
 */
export function createBlockNode(options: BlockNodeOptions) {
  return Node.create<BlockNodeOptions>({
    name: BLOCK_NODE_NAME,
    group: 'block',
    atom: true,
    // Dragged only from the generic block gutter's handle (see gutter/pointerDrag.ts).
    draggable: false,
    selectable: true,

    addOptions: () => options,
    addStorage: (): BlockNodeStorage => ({ blocks: options.blocks }),

    addAttributes() {
      return {
        blockType: {
          default: '',
          parseHTML: (element) => element.getAttribute('data-block-type') ?? '',
          renderHTML: (attrs) => ({ 'data-block-type': String(attrs.blockType) }),
        },
        props: {
          default: {},
          parseHTML: parsePropsAttribute,
          renderHTML: (attrs) => ({ 'data-props': JSON.stringify(attrs.props) }),
        },
      }
    },

    parseHTML: () => [{ tag: 'div[data-embed-block]' }],
    renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-embed-block': '' })],

    addCommands() {
      return {
        insertBlock:
          (blockType, props) =>
          ({ commands }) => {
            const block = this.options.blocks.get(blockType)
            if (!block) return false
            return commands.insertContent({
              type: this.name,
              attrs: { blockType, props: props ?? block.createProps() },
            })
          },
        updateBlockProps:
          (pos, props) =>
          ({ tr, dispatch }) => {
            const node = tr.doc.nodeAt(pos)
            if (node?.type.name !== this.name) return false
            if (dispatch) tr.setNodeAttribute(pos, 'props', props)
            return true
          },
      }
    },

    addNodeView() {
      const nodeOptions = this.options
      return ReactNodeViewRenderer((props) => createElement(BlockView, { ...props, options: nodeOptions }), {
        // ProseMirror paints node decorations on this outer element, not on NodeViewWrapper.
        className: 'page-block',
        attrs: ({ node }) => {
          const blockType = typeof node.attrs.blockType === 'string' ? node.attrs.blockType : ''
          const block = nodeOptions.blocks.get(blockType)
          const attrs: Record<string, string> = {
            'data-block-type': blockType,
            'data-block-feedback': block?.presentation.feedback ?? 'inset',
          }
          const thread = node.attrs.commentThread
          if (thread !== null && thread !== undefined && thread !== '') {
            attrs['data-comment-thread'] = String(thread)
          }
          return attrs
        },
        stopEvent: ({ event }) => {
          const target = event.target
          if (!(target instanceof Element)) return false
          return target.closest('.page-block__body, [data-block-ui]') !== null
        },
        ignoreMutation: () => true,
      })
    },
  })
}
