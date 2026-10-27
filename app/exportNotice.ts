import type { ExportOmission } from '../src/plugins/export/host'

let current: readonly ExportOmission[] = []
const listeners = new Set<() => void>()
export const showExportOmitted = (omitted: readonly ExportOmission[]) => {
  current = omitted
  listeners.forEach((l) => l())
}
export const dismissExportNotice = () => showExportOmitted([])
export const subscribeExportNotice = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}
export const getExportNotice = () => current
