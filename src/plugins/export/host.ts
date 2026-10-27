import type { Doc } from './types'

/** Files that could not be put into an export, with a plain reason each. */
export interface ExportOmission {
  readonly ref: string
  readonly reason: string
}

export interface ExportHost {
  /** Turns references the exporters cannot read (stored files) into content. Must not change its input. */
  readonly prepare?: (doc: Doc) => Promise<{ doc: Doc; omitted: readonly ExportOmission[] }>
  /** Called after an export finished with files left out, so the host can say so. */
  readonly onOmitted?: (omitted: readonly ExportOmission[]) => void
}

let host: ExportHost = {}
/** Host-level setup, once before the editor mounts. */
export const setExportHost = (next: ExportHost): void => {
  host = next
}

/** The document to export, and a report of any files left out. Without a host it is the document unchanged. */
export async function prepareForExport(doc: Doc): Promise<Doc> {
  if (!host.prepare) return doc
  try {
    const prepared = await host.prepare(doc)
    if (prepared.omitted.length > 0) host.onOmitted?.(prepared.omitted)
    return prepared.doc
  } catch {
    host.onOmitted?.([{ ref: '', reason: 'Stored files could not be prepared for this export.' }])
    return doc
  }
}
