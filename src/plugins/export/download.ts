/** Browser-side delivery helpers (not exercised by unit tests). */

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** Opens the standalone HTML in a new tab and triggers the browser's print dialog (save as PDF). */
export function openPrintWindow(html: string): void {
  const view = window.open('', '_blank')
  if (!view) return
  view.document.write(html)
  view.document.close()
  view.focus()
  view.print()
}
