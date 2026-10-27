/** Copies diagram source; returns false when clipboard API is unavailable. */
export async function copyMermaidSource(source: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(source)
    return true
  } catch {
    return false
  }
}
