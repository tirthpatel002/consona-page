/** Turns user input into a safe link target, or null when empty/unsafe (e.g. `javascript:`). */
export function normalizeUrl(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null
  if (value.startsWith('/') || value.startsWith('#')) return value
  return `https://${value}`
}
