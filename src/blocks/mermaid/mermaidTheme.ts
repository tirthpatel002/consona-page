import mermaid from 'mermaid'

let colorProbe: HTMLDivElement | null = null

function ensureColorProbe(): HTMLDivElement {
  if (!colorProbe) {
    colorProbe = document.createElement('div')
    colorProbe.style.display = 'none'
    document.documentElement.appendChild(colorProbe)
  }
  return colorProbe
}

/** Mermaid only accepts rgb/hex — resolve oklch / color-mix via a probe element. */
function pageColor(name: string, fallback: string): string {
  const probe = ensureColorProbe()
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  probe.style.color = raw || fallback
  const resolved = getComputedStyle(probe).color
  probe.style.color = ''
  if (!resolved || resolved === 'rgba(0, 0, 0, 0)' || /oklch|color\(|var\(/i.test(resolved)) return fallback
  return resolved
}

/** Sync Mermaid render theme with --page-* tokens on :root. */
export function applyMermaidPageTheme(): void {
  const bg = pageColor('--page-bg', '#ffffff')
  const fg = pageColor('--page-fg', '#1a1a1a')
  const muted = pageColor('--page-muted', '#eeeeee')
  const border = pageColor('--page-border', '#dddddd')
  const mutedFg = pageColor('--page-muted-fg', '#666666')
  const secondary = pageColor('--page-secondary', '#f0f0f0')
  const selection = pageColor('--page-selection', '#6366f1')

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      darkMode: false,
      background: muted,
      mainBkg: bg,
      secondBkg: secondary,
      tertiaryBkg: muted,
      primaryColor: secondary,
      primaryTextColor: fg,
      primaryBorderColor: border,
      secondaryColor: muted,
      secondaryTextColor: fg,
      secondaryBorderColor: border,
      tertiaryColor: bg,
      tertiaryTextColor: fg,
      tertiaryBorderColor: border,
      lineColor: mutedFg,
      textColor: fg,
      border1: border,
      border2: border,
      nodeBkg: bg,
      nodeBorder: border,
      clusterBkg: muted,
      clusterBorder: border,
      defaultLinkColor: mutedFg,
      titleColor: fg,
      edgeLabelBackground: bg,
      actorBkg: bg,
      actorBorder: border,
      actorTextColor: fg,
      signalColor: mutedFg,
      signalTextColor: fg,
      labelBoxBkgColor: bg,
      labelBoxBorderColor: border,
      labelTextColor: fg,
      loopTextColor: fg,
      noteBkgColor: secondary,
      noteBorderColor: border,
      noteTextColor: fg,
      activationBkgColor: muted,
      activationBorderColor: border,
      sequenceNumberColor: fg,
      sectionBkgColor: muted,
      altSectionBkgColor: secondary,
      sectionBkgColor2: secondary,
      cScale0: selection,
      cScale1: secondary,
      cScale2: muted,
      fontFamily:
        getComputedStyle(document.documentElement).getPropertyValue('--page-font-sans').trim() ||
        'system-ui, sans-serif',
    },
  })
}
