// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareForExport, setExportHost } from '../src/plugins/export/host'
import type { Doc } from '../src/plugins/export/types'

afterEach(() => setExportHost({}))
const doc: Doc = { type: 'doc', content: [] }

describe('export host', () => {
  it('returns the document unchanged without a host', async () => {
    expect(await prepareForExport(doc)).toBe(doc)
  })
  it('uses the prepared document and reports omitted files once', async () => {
    const out: Doc = { type: 'doc', content: [{ type: 'paragraph' }] }
    const onOmitted = vi.fn()
    setExportHost({
      prepare: () => Promise.resolve({ doc: out, omitted: [{ ref: 'blob:abcd', reason: 'Too big.' }] }),
      onOmitted,
    })
    expect(await prepareForExport(doc)).toBe(out)
    expect(onOmitted).toHaveBeenCalledTimes(1)
    setExportHost({ prepare: () => Promise.resolve({ doc: out, omitted: [] }), onOmitted })
    await prepareForExport(doc)
    expect(onOmitted).toHaveBeenCalledTimes(1)
  })
  it('falls back to the original document and says so when preparing fails', async () => {
    const onOmitted = vi.fn()
    setExportHost({ prepare: () => Promise.reject(new Error('x')), onOmitted })
    expect(await prepareForExport(doc)).toBe(doc)
    expect(onOmitted).toHaveBeenCalledTimes(1)
  })
})
