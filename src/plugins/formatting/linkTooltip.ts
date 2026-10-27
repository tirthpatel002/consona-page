import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { placeFloating } from '../../editor/core'

const SHOW_DELAY_MS = 350

/**
 * D3: hovering a link shows its URL in a tooltip, placed by the shared space-aware placement
 * utility (A3): below the link while it fits, flipped above at the bottom edge, clamped inside
 * the viewport horizontally. Works read-only and locked; hides on leave, scroll or press.
 */
export const linkTooltip = Extension.create({
  name: 'pageLinkTooltip',

  addProseMirrorPlugins() {
    const state: {
      tooltip: HTMLDivElement | null
      link: HTMLAnchorElement | null
      timer: ReturnType<typeof setTimeout> | undefined
      /** Link whose `title` we set while the tooltip is up, and the title it had before. */
      titledLink: HTMLAnchorElement | null
      previousTitle: string | null
    } = { tooltip: null, link: null, timer: undefined, titledLink: null, previousTitle: null }

    const hide = () => {
      if (state.timer) clearTimeout(state.timer)
      state.timer = undefined
      state.link = null
      if (state.titledLink) {
        if (state.previousTitle === null) state.titledLink.removeAttribute('title')
        else state.titledLink.setAttribute('title', state.previousTitle)
        state.titledLink = null
        state.previousTitle = null
      }
      if (state.tooltip) state.tooltip.style.display = 'none'
    }

    const show = (link: HTMLAnchorElement) => {
      const tooltip = state.tooltip
      if (!tooltip) return
      const href = link.getAttribute('href')
      if (!href) return
      tooltip.textContent = href
      tooltip.style.display = 'block'
      // Full destination stays inspectable when the tooltip ellipsizes: while ours is up, the link
      // carries the complete URL as its native `title` (longer hover shows it). Restored on hide.
      state.titledLink = link
      state.previousTitle = link.getAttribute('title')
      link.setAttribute('title', href)
      const rect = link.getBoundingClientRect()
      const placed = placeFloating(
        { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
        { width: tooltip.offsetWidth, height: tooltip.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
        { minHeight: 24, align: 'start' },
      )
      tooltip.style.left = `${placed.left}px`
      tooltip.style.top = `${placed.top}px`
      tooltip.dataset.side = placed.side
    }

    const schedule = (link: HTMLAnchorElement) => {
      if (state.link === link && state.timer) return
      if (state.timer) clearTimeout(state.timer)
      state.link = link
      state.timer = setTimeout(() => {
        if (state.link === link) show(link)
      }, SHOW_DELAY_MS)
    }

    return [
      new Plugin({
        key: new PluginKey('pageLinkTooltip'),
        view: () => {
          const tooltip = document.createElement('div')
          tooltip.className = 'page-link-tooltip'
          tooltip.setAttribute('role', 'tooltip')
          tooltip.style.display = 'none'
          document.body.appendChild(tooltip)
          state.tooltip = tooltip
          const onScroll = () => hide()
          window.addEventListener('scroll', onScroll, true)
          return {
            destroy: () => {
              window.removeEventListener('scroll', onScroll, true)
              hide()
              tooltip.remove()
              state.tooltip = null
            },
          }
        },
        props: {
          handleDOMEvents: {
            mousemove(view, event) {
              const target = event.target instanceof Element ? event.target.closest('a[href]') : null
              if (target && view.dom.contains(target)) {
                schedule(target as HTMLAnchorElement)
              } else if (state.link) {
                hide()
              }
              return false
            },
            mousedown() {
              hide()
              return false
            },
            keydown() {
              hide()
              return false
            },
          },
        },
      }),
    ]
  },
})
