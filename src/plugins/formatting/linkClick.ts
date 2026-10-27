import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { isSafeUrl } from '../../editor/core'

/**
 * Clicking a link opens its destination in a new tab (D4) - in editing and in read-only/locked mode alike.
 * The mark itself comes from StarterKit's Link (configured `openOnClick: false` so in-editor clicks never
 * navigate the page away); this plugin owns the one navigation path, so a locked page's links still work (B4).
 */
export const linkClickExtension = Extension.create({
  name: 'pageLinkClick',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('pageLinkClick'),
        props: {
          handleClick: (view, _pos, event) => {
            const target = event.target instanceof Element ? event.target.closest('a[href]') : null
            if (!target || !view.dom.contains(target)) return false
            const href = target.getAttribute('href')
            if (!href) return false
            event.preventDefault()
            if (!isSafeUrl(href)) return true
            window.open(href, '_blank', 'noopener,noreferrer')
            return true
          },
        },
      }),
    ]
  },
})
