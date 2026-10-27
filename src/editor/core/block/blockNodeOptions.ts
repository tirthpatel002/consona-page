import type { BlockModule } from './types'

export const BLOCK_NODE_NAME = 'embedBlock'

export interface BlockNodeOptions {
  readonly blocks: ReadonlyMap<string, BlockModule>
}

export interface BlockNodeStorage {
  readonly blocks: ReadonlyMap<string, BlockModule>
}
