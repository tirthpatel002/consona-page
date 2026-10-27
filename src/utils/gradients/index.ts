import { FEATURED_IDS, GRADIENTS, type Gradient } from './gradients'

export { FEATURED_IDS, GRADIENTS, resolveBlendMode, scaleBlurFull, type Gradient, type Layer } from './gradients'

const byId = new Map(GRADIENTS.map((gradient) => [gradient.id, gradient]))

export const gradientById = (id: string): Gradient | undefined => byId.get(id)

/** Featured covers first, then the rest of the catalog in its original order. */
export const orderedGradients = (): readonly Gradient[] => {
  const featured = new Set(FEATURED_IDS)
  const pinned = FEATURED_IDS.map((id) => byId.get(id)).filter(
    (gradient): gradient is Gradient => gradient !== undefined,
  )
  return [...pinned, ...GRADIENTS.filter((gradient) => !featured.has(gradient.id))]
}
