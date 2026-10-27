import { BulletList, OrderedList, TaskItem, TaskList } from '@tiptap/extension-list'
import { MARKER_IDS } from './markers'

const markerAttribute = {
  marker: {
    default: null,
    parseHTML: (element: HTMLElement) => {
      const value = element.getAttribute('data-marker')
      return value && MARKER_IDS.includes(value) ? value : null
    },
    renderHTML: (attributes: { marker?: string | null }) =>
      attributes.marker && MARKER_IDS.includes(attributes.marker) ? { 'data-marker': attributes.marker } : {},
  },
}

/** Bullet list with a selectable marker (disc, circle, square). The marker is a validated attribute. */
export const MarkedBulletList = BulletList.extend({
  addAttributes() {
    return { ...this.parent?.(), ...markerAttribute }
  },
})

/** Ordered list with a selectable marker (1, a, i). */
export const MarkedOrderedList = OrderedList.extend({
  addAttributes() {
    return { ...this.parent?.(), ...markerAttribute }
  },
})

export const Checklist = TaskList.configure({ HTMLAttributes: { class: 'page-checklist' } })
export const ChecklistItem = TaskItem.configure({ nested: true })
