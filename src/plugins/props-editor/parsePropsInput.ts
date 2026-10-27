import { isJsonObject, type JsonObject } from '../../editor/core'

export type PropsInputResult =
  { readonly ok: true; readonly props: JsonObject } | { readonly ok: false; readonly error: string }

/** Parses the props editor's text into a JSON object (pure). */
export function parsePropsInput(text: string): PropsInputResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}` }
  }
  return isJsonObject(value) ? { ok: true, props: value } : { ok: false, error: 'Props must be a JSON object' }
}
