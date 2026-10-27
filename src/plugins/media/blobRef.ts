const BLOB_REF = /^blob:[A-Za-z0-9_-]{4,64}$/
/** A stored-file reference: `blob:` plus the store id. Never a link target or browser source. */
export const isBlobRef = (value: unknown): value is string => typeof value === 'string' && BLOB_REF.test(value)
export const blobRefFor = (id: string): string => `blob:${id}`
