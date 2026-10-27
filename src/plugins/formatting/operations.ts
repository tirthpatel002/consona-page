import { defineOperation } from '../../editor/core'

export const setTextColor = defineOperation('setTextColor', (chain, color: string | null) =>
  color ? chain.setColor(color) : chain.unsetColor(),
)

export const setBackgroundColor = defineOperation('setBackgroundColor', (chain, color: string | null) =>
  color ? chain.setBackgroundColor(color) : chain.unsetBackgroundColor(),
)
