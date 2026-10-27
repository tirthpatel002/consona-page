export { StaleRevisionError } from './types'
export type { PageStore, PageSummary, PutOptions, StoredPage } from './types'
export { createMemoryStore } from './memoryStore'
export { createIndexedDbStore, SCHEMA_VERSION, type IndexedDbStoreOptions } from './indexedDbStore'
