import type { BlockModule } from '../block/types'
import type { PagePlugin } from './types'

/** Convenience: a plugin that contributes exactly one block. */
export function blockPlugin(block: BlockModule, extra: Omit<PagePlugin, 'id' | 'blocks'> = {}): PagePlugin {
  return { id: `block:${block.type}`, blocks: [block], ...extra }
}
