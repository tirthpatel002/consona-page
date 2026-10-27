// Outlined chevron-down (stroke = currentColor), shared by React toolbar buttons and DOM widgets.

export const CHEVRON_DOWN_PATH = 'M4 6l4 4 4-4'
const SVG_NS = 'http://www.w3.org/2000/svg'

/** DOM version for ProseMirror widgets. */
export function chevronDownSvg(size = 12): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  const attrs = {
    width: String(size),
    height: String(size),
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.75',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  }
  for (const [key, value] of Object.entries(attrs)) svg.setAttribute(key, value)
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', CHEVRON_DOWN_PATH)
  svg.appendChild(path)
  return svg
}
