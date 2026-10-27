export { StaleRevisionError } from './types'
export type { PageChange, PageStore, PageSummary, PutOptions, StoredPage } from './types'
export { createMemoryStore } from './memoryStore'
export { createLocalStorageStore } from './localStorageStore'
export {
  createIndexedDbRegistryStorage,
  createIndexedDbStore,
  SCHEMA_VERSION,
  type IndexedDbStoreOptions,
} from './indexedDbStore'
export { FORMAT_VERSION, isQuotaError, migrateStoredPage, StorageQuotaError, UnsupportedFormatError } from './format'
export { createChangeFeed, type ChangeFeed } from './changeFeed'
export {
  createMemoryRegistryStorage,
  createPageRegistry,
  RegistryError,
  type CreateOptions,
  type PageRecord,
  type PageRegistry,
  type RegistryErrorCode,
  type RegistryOptions,
  type RegistryStorage,
  type Undoable,
} from './registry'
