import { isSafeUrl } from '../../editor/core'
import type { Doc } from './types'

export { isSafeUrl }

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

/** Copy of an imported document with unsafe link targets removed and unsafe media sources dropped. */
export function sanitizeImported(doc: Doc): Doc {
  const clean = (value: Json): Json | undefined => {
    if (Array.isArray(value)) return value.map((item) => clean(item)).filter((item): item is Json => item !== undefined)
    if (value === null || typeof value !== 'object') return value
    if (value.type === 'link' && typeof (value.attrs as { href?: unknown } | undefined)?.href === 'string') {
      const href = String((value.attrs as { href: string }).href)
      if (!isSafeUrl(href)) return undefined
    }
    if (value.type === 'media' && typeof (value.attrs as { src?: unknown } | undefined)?.src === 'string') {
      if (!isSafeUrl(String((value.attrs as { src: string }).src))) return undefined
    }
    const out: { [key: string]: Json } = {}
    for (const [key, child] of Object.entries(value)) {
      const next = clean(child)
      if (next !== undefined) out[key] = next
    }
    return out
  }
  return (clean(doc as unknown as Json) ?? { type: 'doc', content: [] }) as unknown as Doc
}

const URL_ATTRS = ['href', 'src', 'poster', 'action', 'formaction', 'xlink:href', 'data']

/**
 * Cleans pasted HTML at the DOM level: active elements are removed, event-handler attributes and
 * inline styles that load resources are dropped, and URL attributes keep only allowlisted schemes. Editor data attributes
 * are kept, so a copy from this editor still pastes exactly. It does not validate the content of
 * data-props; each block's schema owns that.
 */
export function sanitizePastedHtml(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  parsed.body
    .querySelectorAll('script, style, noscript, template, iframe, object, embed, svg, math, form, link, meta, base')
    .forEach((el) => el.remove())
  parsed.body.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on')) el.removeAttribute(attr.name)
      else if (name === 'style' && /url\(|expression\(|@import|javascript:/i.test(attr.value))
        el.removeAttribute(attr.name)
      else if (URL_ATTRS.includes(name) && !isSafeUrl(attr.value)) el.removeAttribute(attr.name)
    }
  })
  return parsed.body.innerHTML
}
