/** JSON value types used for everything persisted in the document (node attrs, templates). */
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Converts a plain value (e.g. parsed props) into a detached JSON object.
 * Drops `undefined` fields and functions, exactly like persistence would.
 */
export function toJsonObject(value: unknown): JsonObject {
  const parsed: unknown = JSON.parse(JSON.stringify(value ?? {}))
  if (!isJsonObject(parsed)) throw new TypeError('Expected value to serialize to a JSON object')
  return parsed
}
