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
