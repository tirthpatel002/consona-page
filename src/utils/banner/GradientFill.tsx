import type { CSSProperties } from 'react'
import { resolveBlendMode, scaleBlurFull, type Gradient } from '../gradients'

const paper = (dark: boolean): string => (dark ? '#100e0b' : '#faf8f2')

/** Paints one catalog gradient from its layers. `full` is the banner; thumbs stay softer and cheaper. */
export function GradientFill({ gradient, full = false }: { readonly gradient: Gradient; readonly full?: boolean }) {
  return (
    <div className="gradient-fill" style={{ backgroundColor: paper(gradient.dark) }}>
      {gradient.layers.map((layer, index) => {
        const blur = full ? Math.min(80, scaleBlurFull(layer.blur).desktop) : Math.min(layer.blur, 24)
        return (
          <div
            key={index}
            style={{
              backgroundImage: layer.background,
              backgroundSize: layer.backgroundSize ?? 'cover',
              mixBlendMode: resolveBlendMode(layer.blendMode, !gradient.dark) as CSSProperties['mixBlendMode'],
              opacity: layer.opacity ?? 1,
              filter: blur > 0 ? `blur(${blur}px)` : undefined,
            }}
          />
        )
      })}
      {gradient.grain && <span className="gradient-fill__grain" />}
    </div>
  )
}
