/* ── Types ── */

export type GradientMood = 'warm' | 'cool' | 'vivid' | 'dark'
export type Category = 'glow' | 'mesh' | 'nebula' | 'prism' | 'lattice' | 'grain' | 'glass' | 'flux'

export interface Layer {
  background: string
  blendMode: string
  blur: number
  opacity?: number
  /** For repeating patterns (grids, dots, stripes) */
  backgroundSize?: string
  /** Optional stable identity (used as React key when present) */
  id?: string
}

export interface Gradient {
  id: string
  name: string
  category: Category
  mood: GradientMood
  desc: string
  dark: boolean
  text: string
  /** Optional override for title ink on light covers */
  cardText?: string
  base: string
  layers: Layer[]
  grain?: boolean
}

/* ── Category metadata ── */

export interface CategoryMeta {
  id: Category | 'all'
  label: string
  icon: string
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'all', label: 'All', icon: 'lucide:layers' },
  { id: 'glow', label: 'Glow', icon: 'lucide:sun' },
  { id: 'mesh', label: 'Mesh', icon: 'lucide:hexagon' },
  { id: 'nebula', label: 'Nebula', icon: 'lucide:cloud' },
  { id: 'prism', label: 'Prism', icon: 'lucide:triangle' },
  { id: 'lattice', label: 'Lattice', icon: 'lucide:grid-3x3' },
  { id: 'grain', label: 'Grain', icon: 'lucide:scan-line' },
  { id: 'glass', label: 'Glass', icon: 'lucide:diamond' },
  { id: 'flux', label: 'Flux', icon: 'lucide:blob' },
]

/* ══════════════════════════════════════════════════════════════
   GRADIENTS - multi-layer backgrounds
   ══════════════════════════════════════════════════════════════ */

export const GRADIENTS: Gradient[] = [
  {
    id: 'sunrise-drift',
    name: 'Sunrise Drift',
    category: 'glow',
    mood: 'vivid',
    desc: 'Blue into orange, high key',
    dark: false,
    text: '#24406e',
    base: '#0a0a0a',
    layers: [
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(0,138,255,0.1) 30%, rgb(255,255,255) 20%, rgb(247,164,66) 70%, rgb(233,66,247) 100%)',
        blendMode: 'hard-light',
        blur: 30,
        opacity: 1,
      },
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(0,138,255,0.2) 35%, rgb(255,255,255) 70%, rgb(247,164,66) 80%, rgb(233,66,247) 100%)',
        blendMode: 'soft-light',
        blur: 50,
        opacity: 1,
      },
    ],
  },

  {
    id: 'ember-glow',
    name: 'Ember Glow',
    category: 'glow',
    mood: 'warm',
    desc: 'Coral into deep rose',
    dark: false,
    text: '#7a1f2e',
    base: '#faf8f2',
    layers: [
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,106,61,0.12) 28%, rgb(255,255,255) 18%, rgb(255,201,77) 68%, rgb(255,61,119) 100%)',
        blendMode: 'hard-light',
        blur: 36,
      },
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,106,61,0.22) 34%, rgb(255,255,255) 66%, rgb(255,201,77) 82%, rgb(255,61,119) 100%)',
        blendMode: 'soft-light',
        blur: 36,
      },
    ],
  },

  {
    id: 'glacier-mist',
    name: 'Glacier Mist',
    category: 'glow',
    mood: 'cool',
    desc: 'Cyan into indigo',
    dark: false,
    text: '#1f3b6e',
    base: '#faf8f2',
    layers: [
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(77,210,255,0.12) 28%, rgb(255,255,255) 18%, rgb(53,230,192) 68%, rgb(91,110,245) 100%)',
        blendMode: 'hard-light',
        blur: 36,
      },
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(77,210,255,0.22) 34%, rgb(255,255,255) 66%, rgb(53,230,192) 82%, rgb(91,110,245) 100%)',
        blendMode: 'soft-light',
        blur: 36,
      },
    ],
  },

  {
    id: 'orchid-bloom',
    name: 'Orchid Bloom',
    category: 'glow',
    mood: 'vivid',
    desc: 'Magenta into blue',
    dark: false,
    text: '#5b1f6e',
    base: '#faf8f2',
    layers: [
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(242,61,224,0.12) 28%, rgb(255,255,255) 18%, rgb(139,92,246) 68%, rgb(61,139,255) 100%)',
        blendMode: 'hard-light',
        blur: 36,
      },
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(242,61,224,0.22) 34%, rgb(255,255,255) 66%, rgb(139,92,246) 82%, rgb(61,139,255) 100%)',
        blendMode: 'soft-light',
        blur: 36,
      },
    ],
  },

  {
    id: 'warm-ash',
    name: 'Warm Ash',
    category: 'glow',
    mood: 'warm',
    desc: 'Warm greige tones, understated and airy',
    dark: false,
    text: '#4a4238',
    base: '#f7f5f0',
    layers: [
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(214,204,190,0.12) 28%, rgb(255,255,255) 18%, rgb(196,181,160) 68%, rgb(168,148,122) 100%)',
        blendMode: 'hard-light',
        blur: 36,
      },
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(214,204,190,0.22) 34%, rgb(255,255,255) 66%, rgb(196,181,160) 82%, rgb(168,148,122) 100%)',
        blendMode: 'soft-light',
        blur: 36,
      },
    ],
  },

  {
    id: 'golden-hour',
    name: 'Golden Hour',
    category: 'glow',
    mood: 'warm',
    desc: 'Amber melting into burnt sienna',
    dark: false,
    text: '#5c2e0a',
    base: '#faf8f2',
    layers: [
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,183,77,0.12) 28%, rgb(255,255,255) 18%, rgb(255,138,61) 68%, rgb(183,77,0) 100%)',
        blendMode: 'hard-light',
        blur: 50,
      },
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,183,77,0.22) 34%, rgb(255,255,255) 66%, rgb(255,138,61) 82%, rgb(183,77,0) 100%)',
        blendMode: 'soft-light',
        blur: 40,
      },
    ],
  },

  {
    id: 'rose-gold',
    name: 'Rose Gold',
    category: 'glow',
    mood: 'warm',
    desc: 'Blush pink dissolving into antique copper',
    dark: false,
    text: '#6e2e2a',
    base: '#faf2f2',
    layers: [
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,183,178,0.12) 28%, rgb(255,255,255) 18%, rgb(255,145,140) 68%, rgb(200,120,115) 100%)',
        blendMode: 'hard-light',
        blur: 36,
      },
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,183,178,0.22) 34%, rgb(255,255,255) 66%, rgb(255,145,140) 82%, rgb(200,120,115) 100%)',
        blendMode: 'soft-light',
        blur: 36,
      },
    ],
  },

  {
    id: 'sunset-boulevard',
    name: 'Sunset Boulevard',
    category: 'glow',
    mood: 'warm',
    desc: 'Coral haze fading into honeyed amber',
    dark: false,
    text: '#6e2a1a',
    base: '#faf6f2',
    layers: [
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,107,107,0.12) 28%, rgb(255,255,255) 18%, rgb(255,170,100) 68%, rgb(255,200,80) 100%)',
        blendMode: 'hard-light',
        blur: 36,
      },
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,107,107,0.22) 34%, rgb(255,255,255) 66%, rgb(255,170,100) 82%, rgb(255,200,80) 100%)',
        blendMode: 'soft-light',
        blur: 36,
      },
    ],
  },

  {
    id: 'champagne-fizz',
    name: 'Champagne Fizz',
    category: 'glow',
    mood: 'warm',
    desc: 'Pale gold bubbling into peach nectar',
    dark: false,
    text: '#5c3d1a',
    base: '#faf8f2',
    layers: [
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,230,180,0.12) 28%, rgb(255,255,255) 18%, rgb(255,200,140) 68%, rgb(230,170,100) 100%)',
        blendMode: 'hard-light',
        blur: 36,
      },
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(255,230,180,0.22) 34%, rgb(255,255,255) 66%, rgb(255,200,140) 82%, rgb(230,170,100) 100%)',
        blendMode: 'soft-light',
        blur: 36,
      },
    ],
  },

  {
    id: 'midnight-sapphire',
    name: 'Midnight Sapphire',
    category: 'glow',
    mood: 'cool',
    desc: 'Deep cobalt bleeding into violet ink',
    dark: false,
    text: '#c8d4ff',
    base: '#0a0c1a',
    layers: [
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(61,90,255,0.12) 28%, rgb(255,255,255) 18%, rgb(45,55,135) 68%, rgb(20,25,60) 100%)',
        blendMode: 'hard-light',
        blur: 36,
      },
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(61,90,255,0.22) 34%, rgb(255,255,255) 66%, rgb(45,55,135) 82%, rgb(20,25,60) 100%)',
        blendMode: 'soft-light',
        blur: 36,
      },
    ],
  },

  {
    id: 'ocean-pearl',
    name: 'Ocean Pearl',
    category: 'glow',
    mood: 'cool',
    desc: 'Seafoam drifting into abyssal blue',
    dark: false,
    text: '#1a3a4a',
    base: '#f0f7fa',
    layers: [
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(178,235,242,0.12) 28%, rgb(255,255,255) 18%, rgb(77,182,200) 68%, rgb(45,100,130) 100%)',
        blendMode: 'hard-light',
        blur: 36,
      },
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(178,235,242,0.22) 34%, rgb(255,255,255) 66%, rgb(77,182,200) 82%, rgb(45,100,130) 100%)',
        blendMode: 'soft-light',
        blur: 36,
      },
    ],
  },

  {
    id: 'arctic-frost',
    name: 'Arctic Frost',
    category: 'glow',
    mood: 'cool',
    desc: 'Ice crystal refracting into periwinkle',
    dark: false,
    text: '#1a2a4a',
    base: '#f2f6fa',
    layers: [
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(200,230,255,0.12) 28%, rgb(255,255,255) 18%, rgb(150,200,255) 68%, rgb(100,130,200) 100%)',
        blendMode: 'hard-light',
        blur: 36,
      },
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(200,230,255,0.22) 34%, rgb(255,255,255) 66%, rgb(150,200,255) 82%, rgb(100,130,200) 100%)',
        blendMode: 'soft-light',
        blur: 36,
      },
    ],
  },

  {
    id: 'silver-mist',
    name: 'Silver Mist',
    category: 'glow',
    mood: 'cool',
    desc: 'Mercury grey dissolving into pale lilac',
    dark: false,
    text: '#2a2a3a',
    base: '#f5f5f7',
    layers: [
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(200,200,210,0.12) 28%, rgb(255,255,255) 18%, rgb(160,160,180) 68%, rgb(130,120,160) 100%)',
        blendMode: 'hard-light',
        blur: 36,
      },
      {
        background:
          'linear-gradient(rgba(0,0,0,0) 0%, rgba(200,200,210,0.22) 34%, rgb(255,255,255) 66%, rgb(160,160,180) 82%, rgb(130,120,160) 100%)',
        blendMode: 'soft-light',
        blur: 36,
      },
    ],
  },

  {
    id: 'phantom-arc',
    name: 'Phantom Arc',
    category: 'glow',
    mood: 'dark',
    desc: 'Deep black void with an expansive electric blue neon arc and an ultra-thin sand rose bottom edge',
    dark: true,
    text: '#e0e8ff',
    base: '#000000',
    layers: [
      {
        background:
          'radial-gradient(ellipse 120% 145% at 50% -50%, rgba(0,0,0,0) 60%, rgb(12,24,210) 78%, rgba(0,0,0,0) 85%)',
        blendMode: 'screen',
        blur: 20,
        opacity: 1,
      },
      {
        background:
          'radial-gradient(ellipse 120% 145% at 50% -50%, rgba(0,0,0,0) 55%, rgba(12,24,210,0.4) 80%, rgba(0,0,0,0) 100%)',
        blendMode: 'screen',
        blur: 70,
        opacity: 0.9,
      },
      {
        background:
          'radial-gradient(ellipse 120% 145% at 50% -50%, rgba(0,0,0,0) 83.5%, #c8a8a6 84.5%, rgba(0,0,0,0) 85.5%)',
        blendMode: 'lighten',
        blur: 20,
        opacity: 0.8,
      },
    ],
  },

  {
    id: 'vercel-edge-glow',
    name: 'Vercel Edge',
    category: 'glow',
    mood: 'dark',
    desc: 'Deep tech aesthetic with a stark silver-white arc fading into a sharp cyberpunk violet edge',
    dark: true,
    text: '#ffffff',
    base: '#000000',
    layers: [
      {
        background:
          'radial-gradient(ellipse 120% 145% at 50% -50%, rgba(0,0,0,0) 58%, rgb(240,240,245) 76%, rgba(0,0,0,0) 84%)',
        blendMode: 'screen',
        blur: 25,
        opacity: 0.9,
      },
      {
        background:
          'radial-gradient(ellipse 120% 145% at 50% -50%, rgba(0,0,0,0) 50%, rgba(121,42,242,0.35) 78%, rgba(0,0,0,0) 100%)',
        blendMode: 'screen',
        blur: 80,
        opacity: 1,
      },
      {
        background:
          'radial-gradient(ellipse 120% 145% at 50% -50%, rgba(0,0,0,0) 82.5%, #ff007a 83.5%, rgba(0,0,0,0) 84.5%)',
        blendMode: 'lighten',
        blur: 12,
        opacity: 0.75,
      },
    ],
  },

  {
    id: 'mesh-bourbon-smoke',
    name: 'Bourbon Smoke',
    category: 'mesh',
    mood: 'warm',
    desc: 'Amber liquid light refracting through oak-aged haze',
    dark: true,
    text: '#fbbf24',
    base: '#0f0800',
    layers: [
      {
        background: 'radial-gradient(circle at 25% 30%, rgba(180,83,9,0.6) 0%, transparent 45%)',
        blendMode: 'screen',
        blur: 45,
      },
      {
        background: 'radial-gradient(circle at 75% 25%, rgba(217,119,6,0.5) 0%, transparent 40%)',
        blendMode: 'screen',
        blur: 45,
      },
      {
        background: 'radial-gradient(circle at 50% 75%, rgba(120,53,15,0.5) 0%, transparent 50%)',
        blendMode: 'multiply',
        blur: 90,
      },
      {
        background: 'radial-gradient(circle at 20% 80%, rgba(251,191,36,0.25) 0%, transparent 35%)',
        blendMode: 'overlay',
        blur: 100,
      },
    ],
  },

  {
    id: 'mesh-digital-rain',
    name: 'Digital Rain',
    category: 'mesh',
    mood: 'cool',
    desc: 'Matrix code dissolving into phosphor green pools',
    dark: true,
    text: '#4ade80',
    base: '#000a00',
    layers: [
      {
        background: 'radial-gradient(circle at 30% 20%, rgba(34,197,94,0.7) 0%, transparent 45%)',
        blendMode: 'screen',
        blur: 75,
      },
      {
        background: 'radial-gradient(circle at 70% 35%, rgba(16,185,129,0.5) 0%, transparent 40%)',
        blendMode: 'screen',
        blur: 85,
      },
      {
        background: 'radial-gradient(circle at 45% 70%, rgba(6,182,212,0.4) 0%, transparent 50%)',
        blendMode: 'screen',
        blur: 70,
      },
      {
        background: 'radial-gradient(circle at 80% 80%, rgba(132,204,22,0.2) 0%, transparent 30%)',
        blendMode: 'overlay',
        blur: 55,
      },
    ],
  },

  {
    id: 'mesh-golden-coast',
    name: 'Golden Coast',
    category: 'mesh',
    mood: 'warm',
    desc: 'Sunset beach mesh with amber and coral nodes',
    dark: false,
    cardText: '#000000',
    text: '#5b3a1f',
    base: '#fffbeb',
    layers: [
      {
        background: 'radial-gradient(circle at 25% 25%, rgba(251,191,36,0.6) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 70,
      },
      {
        background: 'radial-gradient(circle at 75% 35%, rgba(251,146,60,0.5) 0%, transparent 40%)',
        blendMode: 'normal',
        blur: 80,
      },
      {
        background: 'radial-gradient(circle at 50% 75%, rgba(244,63,94,0.4) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 90,
      },
      {
        background: 'radial-gradient(circle at 85% 80%, rgba(245,158,11,0.3) 0%, transparent 35%)',
        blendMode: 'soft-light',
        blur: 60,
      },
    ],
  },

  {
    id: 'mesh-sakura',
    name: 'Sakura Fields',
    category: 'mesh',
    mood: 'warm',
    desc: 'Cherry blossom pink mesh with warm peach nodes',
    dark: false,
    cardText: '#000000',
    text: '#6e2848',
    base: '#fdf2f8',
    layers: [
      {
        background: 'radial-gradient(circle at 20% 30%, rgba(251,113,133,0.7) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 60,
      },
      {
        background: 'radial-gradient(circle at 80% 20%, rgba(249,168,212,0.6) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 70,
      },
      {
        background: 'radial-gradient(circle at 60% 80%, rgba(253,164,175,0.5) 0%, transparent 55%)',
        blendMode: 'normal',
        blur: 80,
      },
      {
        background: 'radial-gradient(circle at 30% 70%, rgba(244,114,182,0.4) 0%, transparent 40%)',
        blendMode: 'soft-light',
        blur: 50,
      },
    ],
  },

  {
    id: 'mesh-citrine',
    name: 'Citrine Mesh',
    category: 'mesh',
    mood: 'warm',
    desc: 'Sunlit yellow-gold mesh with amber nodes',
    dark: false,
    cardText: '#000000',
    text: '#5a4a10',
    base: '#fffef0',
    layers: [
      {
        background: 'radial-gradient(circle at 22% 28%, rgba(250,204,21,0.6) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 70,
      },
      {
        background: 'radial-gradient(circle at 78% 32%, rgba(253,224,71,0.5) 0%, transparent 40%)',
        blendMode: 'normal',
        blur: 80,
      },
      {
        background: 'radial-gradient(circle at 50% 78%, rgba(234,179,8,0.4) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 85,
      },
      {
        background: 'radial-gradient(circle at 85% 75%, rgba(202,138,4,0.3) 0%, transparent 35%)',
        blendMode: 'soft-light',
        blur: 55,
      },
    ],
  },

  {
    id: 'mesh-lavender-haze',
    name: 'Lavender Haze',
    category: 'mesh',
    mood: 'vivid',
    desc: 'Soft purple mesh with lilac and mauve nodes',
    dark: false,
    cardText: '#000000',
    text: '#4c1d95',
    base: '#faf5ff',
    layers: [
      {
        background: 'radial-gradient(circle at 20% 40%, rgba(192,132,252,0.6) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 80,
      },
      {
        background: 'radial-gradient(circle at 70% 30%, rgba(167,139,250,0.5) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 70,
      },
      {
        background: 'radial-gradient(circle at 45% 75%, rgba(216,180,254,0.4) 0%, transparent 40%)',
        blendMode: 'normal',
        blur: 90,
      },
      {
        background: 'radial-gradient(circle at 85% 65%, rgba(232,121,249,0.35) 0%, transparent 35%)',
        blendMode: 'soft-light',
        blur: 60,
      },
    ],
  },

  {
    id: 'mesh-rose-quartz',
    name: 'Rose Quartz',
    category: 'mesh',
    mood: 'warm',
    desc: 'Crystalline pink formations catching dawn light',
    dark: false,
    cardText: '#000000',
    text: '#9d174d',
    base: '#fdf2f8',
    layers: [
      {
        background: 'radial-gradient(circle at 22% 28%, rgba(251,113,133,0.6) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 80,
      },
      {
        background: 'radial-gradient(circle at 78% 32%, rgba(244,114,182,0.5) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 70,
      },
      {
        background: 'radial-gradient(circle at 50% 78%, rgba(253,164,175,0.4) 0%, transparent 55%)',
        blendMode: 'soft-light',
        blur: 85,
      },
      {
        background: 'radial-gradient(circle at 30% 70%, rgba(255,228,230,0.5) 0%, transparent 40%)',
        blendMode: 'overlay',
        blur: 60,
      },
    ],
  },

  {
    id: 'mesh-saffron-silk',
    name: 'Saffron Silk',
    category: 'mesh',
    mood: 'warm',
    desc: 'Spice market warmth woven through golden fabric folds',
    dark: false,
    cardText: '#000000',
    text: '#78350f',
    base: '#fffbeb',
    layers: [
      {
        background: 'radial-gradient(circle at 20% 25%, rgba(234,179,8,0.6) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 75,
      },
      {
        background: 'radial-gradient(circle at 80% 30%, rgba(217,119,6,0.5) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 70,
      },
      {
        background: 'radial-gradient(circle at 50% 80%, rgba(180,83,9,0.4) 0%, transparent 55%)',
        blendMode: 'soft-light',
        blur: 85,
      },
      {
        background: 'radial-gradient(circle at 30% 70%, rgba(251,191,36,0.3) 0%, transparent 40%)',
        blendMode: 'overlay',
        blur: 60,
      },
    ],
  },

  {
    id: 'mesh-solar-flare',
    name: 'Solar Flare',
    category: 'mesh',
    mood: 'warm',
    desc: 'Coronal mass ejection captured in frozen light',
    dark: false,
    cardText: '#000000',
    text: '#8b4513',
    base: '#fff8e7',
    layers: [
      {
        background: 'radial-gradient(circle at 20% 25%, rgba(255,200,50,0.7) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 80,
      },
      {
        background: 'radial-gradient(circle at 80% 20%, rgba(255,140,0,0.6) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 70,
      },
      {
        background: 'radial-gradient(circle at 50% 75%, rgba(255,69,0,0.5) 0%, transparent 55%)',
        blendMode: 'soft-light',
        blur: 90,
      },
      {
        background: 'radial-gradient(circle at 30% 70%, rgba(255,255,200,0.4) 0%, transparent 40%)',
        blendMode: 'overlay',
        blur: 60,
      },
    ],
  },

  {
    id: 'mesh-frosted-jade',
    name: 'Frosted Jade',
    category: 'mesh',
    mood: 'cool',
    desc: 'Ancient jade carved from glacier ice and mountain mist',
    dark: false,
    cardText: '#000000',
    text: '#065f46',
    base: '#f0fdf4',
    layers: [
      {
        background: 'radial-gradient(circle at 25% 30%, rgba(52,211,153,0.5) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 80,
      },
      {
        background: 'radial-gradient(circle at 75% 25%, rgba(16,185,129,0.4) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 70,
      },
      {
        background: 'radial-gradient(circle at 50% 80%, rgba(6,182,212,0.35) 0%, transparent 55%)',
        blendMode: 'soft-light',
        blur: 85,
      },
      {
        background: 'radial-gradient(circle at 30% 70%, rgba(209,250,229,0.5) 0%, transparent 40%)',
        blendMode: 'overlay',
        blur: 60,
      },
    ],
  },

  {
    id: 'mesh-tropical-punch',
    name: 'Tropical Punch',
    category: 'mesh',
    mood: 'vivid',
    desc: 'Mango and dragon fruit colliding in a blender of light',
    dark: false,
    cardText: '#000000',
    text: '#be123c',
    base: '#fff1f2',
    layers: [
      {
        background: 'radial-gradient(circle at 22% 28%, rgba(251,146,60,0.6) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 80,
      },
      {
        background: 'radial-gradient(circle at 78% 32%, rgba(244,63,94,0.5) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 70,
      },
      {
        background: 'radial-gradient(circle at 50% 78%, rgba(250,204,21,0.4) 0%, transparent 55%)',
        blendMode: 'soft-light',
        blur: 90,
      },
      {
        background: 'radial-gradient(circle at 85% 70%, rgba(236,72,153,0.3) 0%, transparent 35%)',
        blendMode: 'overlay',
        blur: 60,
      },
    ],
  },

  {
    id: 'mesh-cotton-candy',
    name: 'Cotton Candy',
    category: 'mesh',
    mood: 'vivid',
    desc: 'Sugar-spun clouds dissolving in pastel twilight',
    dark: false,
    cardText: '#000000',
    text: '#be185d',
    base: '#fff0f5',
    layers: [
      {
        background: 'radial-gradient(circle at 20% 30%, rgba(244,114,182,0.6) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 80,
      },
      {
        background: 'radial-gradient(circle at 75% 25%, rgba(167,139,250,0.5) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 70,
      },
      {
        background: 'radial-gradient(circle at 50% 80%, rgba(253,186,116,0.4) 0%, transparent 55%)',
        blendMode: 'soft-light',
        blur: 90,
      },
      {
        background: 'radial-gradient(circle at 85% 70%, rgba(192,132,252,0.3) 0%, transparent 35%)',
        blendMode: 'overlay',
        blur: 60,
      },
    ],
  },

  {
    id: 'mesh-alpine-meadow',
    name: 'Alpine Meadow',
    category: 'mesh',
    mood: 'cool',
    desc: 'Wildflower blooms scattered across high altitude pastures',
    dark: false,
    cardText: '#000000',
    text: '#14532d',
    base: '#f0fdf4',
    layers: [
      {
        background: 'radial-gradient(circle at 20% 30%, rgba(132,204,22,0.5) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 80,
      },
      {
        background: 'radial-gradient(circle at 75% 25%, rgba(52,211,153,0.4) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 70,
      },
      {
        background: 'radial-gradient(circle at 50% 80%, rgba(250,204,21,0.35) 0%, transparent 55%)',
        blendMode: 'soft-light',
        blur: 85,
      },
      {
        background: 'radial-gradient(circle at 30% 70%, rgba(167,139,250,0.25) 0%, transparent 40%)',
        blendMode: 'overlay',
        blur: 60,
      },
    ],
  },

  {
    id: 'blood-aurora',
    name: 'Blood Aurora',
    category: 'nebula',
    mood: 'dark',
    desc: 'Crimson and gold aurora curtains burning across an absolute night sky',
    dark: true,
    text: '#ffe0d0',
    base: '#050101',
    grain: true,
    layers: [
      {
        background:
          'linear-gradient(154deg, transparent 18%, rgba(60,10,10,0.06) 29%, rgba(255,40,0,0.40) 36%, rgb(255,255,255) 42%, rgba(207,60,20,0.32) 48%, rgba(158,20,10,0.22) 55%, rgba(255,90,0,0.30) 62%, rgba(60,15,10,0.08) 68%, transparent 82%)',
        blendMode: 'screen',
        blur: 34,
        opacity: 1,
      },
      {
        background:
          'linear-gradient(128deg, transparent 28%, rgba(80,10,20,0.06) 38%, rgba(255,80,0,0.35) 43%, rgb(255,255,255) 48%, rgba(200,60,30,0.22) 52%, rgba(255,40,0,0.25) 57%, rgba(90,20,10,0.10) 62%, transparent 76%)',
        blendMode: 'screen',
        blur: 30,
        opacity: 0.9,
      },
      {
        background:
          'radial-gradient(ellipse 78% 20% at 51% 53%, rgba(200,50,20,0.24) 0%, rgba(100,20,10,0.10) 45%, transparent 82%)',
        blendMode: 'screen',
        blur: 28,
        opacity: 0.9,
      },
      {
        background:
          'radial-gradient(ellipse 48% 9% at 52% 50%, rgba(255,220,190,0.14) 0%, rgba(200,80,50,0.06) 45%, transparent 80%)',
        blendMode: 'screen',
        blur: 70,
        opacity: 1,
      },
      {
        background:
          'linear-gradient(to top, rgba(5,1,1,0.90) 0%, rgba(5,1,1,0.58) 28%, rgba(5,1,1,0.20) 55%, transparent 78%)',
        blendMode: 'multiply',
        blur: 32,
        opacity: 0.9,
      },
      {
        background:
          'radial-gradient(ellipse 50% 28% at 72% 18%, rgba(150,90,20,0.10) 0%, rgba(100,60,10,0.04) 45%, transparent 82%)',
        blendMode: 'screen',
        blur: 55,
        opacity: 0.7,
      },
    ],
  },

  {
    id: 'aurora-borealis',
    name: 'Aurora Borealis',
    category: 'nebula',
    mood: 'vivid',
    desc: 'Layered emerald and cyan aurora curtains drifting across a midnight sky',
    dark: true,
    text: '#e1fff6',
    base: '#020509',
    grain: true,
    layers: [
      {
        background:
          'linear-gradient(154deg, transparent 18%, rgba(12,72,61,0.06) 29%, rgba(0,229,255,0.40) 36%, rgb(255,255,255) 42%, rgba(73,207,158,0.32) 48%, rgba(38,158,119,0.22) 55%, rgba(0,183,255,0.30) 62%, rgba(15,76,65,0.08) 68%, transparent 82%)',
        blendMode: 'screen',
        blur: 34,
        opacity: 1,
      },
      {
        background:
          'linear-gradient(128deg, transparent 28%, rgba(15,82,96,0.06) 38%, rgba(0,183,255,0.35) 43%, rgb(255,255,255) 48%, rgba(68,197,185,0.22) 52%, rgba(0,229,255,0.25) 57%, rgba(25,105,112,0.10) 62%, transparent 76%)',
        blendMode: 'screen',
        blur: 30,
        opacity: 0.9,
      },
      {
        background:
          'radial-gradient(ellipse 78% 20% at 51% 53%, rgba(65,183,155,0.24) 0%, rgba(30,102,91,0.10) 45%, transparent 82%)',
        blendMode: 'screen',
        blur: 28,
        opacity: 0.9,
      },
      {
        background:
          'radial-gradient(ellipse 48% 9% at 52% 50%, rgba(190,255,226,0.14) 0%, rgba(91,195,163,0.06) 45%, transparent 80%)',
        blendMode: 'screen',
        blur: 70,
        opacity: 1,
      },
      {
        background:
          'linear-gradient(to top, rgba(1,5,13,0.90) 0%, rgba(2,7,16,0.58) 28%, rgba(3,9,20,0.20) 55%, transparent 78%)',
        blendMode: 'multiply',
        blur: 32,
        opacity: 0.9,
      },
      {
        background:
          'radial-gradient(ellipse 50% 28% at 72% 18%, rgba(89,62,151,0.10) 0%, rgba(57,44,100,0.04) 45%, transparent 82%)',
        blendMode: 'screen',
        blur: 55,
        opacity: 0.7,
      },
    ],
  },

  {
    id: 'deep-cosmos',
    name: 'Deep Cosmos',
    category: 'nebula',
    mood: 'cool',
    desc: 'Deep purple abyss with stellar glows and distant twinkling stars',
    dark: true,
    text: '#ffffff',
    base: '#0F0F12',
    layers: [
      {
        background: 'linear-gradient(180deg, #0F0F12 0%, rgba(76, 29, 149, 0.5) 50%, rgba(109, 40, 217, 0.7) 100%)',
        blendMode: 'normal',
        blur: 0,
        opacity: 1,
      },
      {
        background:
          'radial-gradient(ellipse at 50% 115%, rgba(147, 51, 234, 0.55) 0%, rgba(109, 40, 217, 0.2) 60%, transparent 80%)',
        blendMode: 'screen',
        blur: 120,
        opacity: 1,
      },
      {
        background: 'radial-gradient(circle at 100% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 40%)',
        blendMode: 'screen',
        blur: 100,
        opacity: 1,
      },
      {
        background: `
          radial-gradient(circle at 12% 18%, rgba(255,255,255,0.8) 1px, transparent 3px),
          radial-gradient(circle at 78% 14%, rgba(250,232,255,0.9) 1.5px, transparent 4px),
          radial-gradient(circle at 88% 44%, rgba(255,255,255,0.7) 1px, transparent 3px),
          radial-gradient(circle at 18% 58%, rgba(233,213,255,1) 1.5px, transparent 4px),
          radial-gradient(circle at 6% 40%, rgba(255,255,255,0.6) 1px, transparent 3px),
          radial-gradient(circle at 68% 6%, rgba(250,232,255,0.8) 1px, transparent 3px)
        `,
        blendMode: 'screen',
        blur: 0,
        opacity: 1,
      },
    ],
  },

  {
    id: 'starlit-abyss',
    name: 'Starlit Abyss',
    category: 'nebula',
    mood: 'cool',
    desc: 'Indigo void with a distant glow and scattered stars',
    dark: true,
    text: '#e0e4ff',
    base: '#06060c',
    layers: [
      {
        background: 'linear-gradient(180deg, #06060c 0%, rgba(30,27,75,0.5) 50%, rgba(49,46,129,0.6) 100%)',
        blendMode: 'normal',
        blur: 0,
        opacity: 1,
      },
      {
        background:
          'radial-gradient(ellipse at 50% 115%, rgba(79,70,229,0.55) 0%, rgba(49,46,129,0.15) 60%, transparent 80%)',
        blendMode: 'screen',
        blur: 120,
        opacity: 1,
      },
      {
        background: 'radial-gradient(circle at 15% 20%, rgba(56,189,248,0.15) 0%, transparent 40%)',
        blendMode: 'screen',
        blur: 100,
        opacity: 1,
      },
      {
        background: `
          radial-gradient(circle at 10% 15%, rgba(255,255,255,0.8) 1px, transparent 3px),
          radial-gradient(circle at 82% 10%, rgba(199,210,254,0.9) 1.5px, transparent 4px),
          radial-gradient(circle at 90% 48%, rgba(255,255,255,0.7) 1px, transparent 3px),
          radial-gradient(circle at 22% 62%, rgba(224,231,255,1) 1.5px, transparent 4px),
          radial-gradient(circle at 5% 45%, rgba(255,255,255,0.6) 1px, transparent 3px),
          radial-gradient(circle at 65% 8%, rgba(199,210,254,0.8) 1px, transparent 3px)
        `,
        blendMode: 'screen',
        blur: 0,
        opacity: 1,
      },
    ],
  },

  {
    id: 'stardust-halo',
    name: 'Stardust Halo',
    category: 'nebula',
    mood: 'vivid',
    desc: 'Magenta halo glowing through a field of distant stars',
    dark: true,
    text: '#ffe4f5',
    base: '#0a0612',
    layers: [
      {
        background: 'linear-gradient(180deg, #0a0612 0%, rgba(76,29,90,0.5) 50%, rgba(157,23,138,0.5) 100%)',
        blendMode: 'normal',
        blur: 0,
        opacity: 1,
      },
      {
        background:
          'radial-gradient(ellipse at 50% 110%, rgba(232,121,249,0.55) 0%, rgba(157,23,138,0.15) 60%, transparent 80%)',
        blendMode: 'screen',
        blur: 120,
        opacity: 1,
      },
      {
        background: 'radial-gradient(circle at 80% 20%, rgba(244,114,182,0.2) 0%, transparent 40%)',
        blendMode: 'screen',
        blur: 100,
        opacity: 1,
      },
      {
        background: `
          radial-gradient(circle at 20% 20%, rgba(255,255,255,0.8) 1px, transparent 3px),
          radial-gradient(circle at 70% 12%, rgba(250,232,255,0.9) 1.5px, transparent 4px),
          radial-gradient(circle at 88% 55%, rgba(255,255,255,0.7) 1px, transparent 3px),
          radial-gradient(circle at 12% 60%, rgba(233,213,255,1) 1.5px, transparent 4px),
          radial-gradient(circle at 40% 8%, rgba(255,255,255,0.6) 1px, transparent 3px)
        `,
        blendMode: 'screen',
        blur: 0,
        opacity: 1,
      },
    ],
  },

  {
    id: 'orion-drift',
    name: 'Orion Drift',
    category: 'nebula',
    mood: 'cool',
    desc: 'Cold blue-white glow beneath a dense star field',
    dark: true,
    text: '#dbeeff',
    base: '#04070f',
    layers: [
      {
        background: 'radial-gradient(ellipse 55% 50% at 40% 45%, rgba(56,189,248,0.6) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 65,
      },
      {
        background: 'radial-gradient(ellipse 40% 45% at 65% 60%, rgba(255,255,255,0.35) 0%, transparent 60%)',
        blendMode: 'soft-light',
        blur: 55,
      },
      {
        background: `
          radial-gradient(circle at 8% 12%, rgba(255,255,255,0.9) 1px, transparent 3px),
          radial-gradient(circle at 30% 8%, rgba(255,255,255,0.7) 1px, transparent 3px),
          radial-gradient(circle at 60% 15%, rgba(199,210,254,0.9) 1.5px, transparent 4px),
          radial-gradient(circle at 85% 22%, rgba(255,255,255,0.7) 1px, transparent 3px),
          radial-gradient(circle at 92% 60%, rgba(255,255,255,0.8) 1.5px, transparent 4px),
          radial-gradient(circle at 45% 75%, rgba(199,210,254,1) 1.5px, transparent 4px),
          radial-gradient(circle at 15% 68%, rgba(255,255,255,0.6) 1px, transparent 3px)
        `,
        blendMode: 'screen',
        blur: 0,
        opacity: 1,
      },
    ],
  },

  {
    id: 'nebula-golden-dawn',
    name: 'Golden Dawn',
    category: 'nebula',
    mood: 'warm',
    desc: 'Solar flares condensing into molten gold spheres',
    dark: true,
    text: '#fff3cd',
    base: '#0f0800',
    layers: [
      {
        background: 'radial-gradient(ellipse 45% 50% at 30% 40%, rgba(251,191,36,0.85) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 35% 40% at 70% 35%, rgba(234,179,8,0.7) 0%, transparent 60%)',
        blendMode: 'screen',
        blur: 50,
      },
      {
        background: 'radial-gradient(ellipse 30% 35% at 50% 75%, rgba(217,119,6,0.5) 0%, transparent 55%)',
        blendMode: 'screen',
        blur: 45,
      },
      {
        background: 'radial-gradient(ellipse 20% 25% at 80% 70%, rgba(180,83,9,0.35) 0%, transparent 60%)',
        blendMode: 'screen',
        blur: 35,
      },
    ],
  },

  {
    id: 'nebula-arctic-ice',
    name: 'Arctic Ice',
    category: 'nebula',
    mood: 'cool',
    desc: 'Frozen nitrogen crystals orbiting a distant white dwarf',
    dark: true,
    text: '#cffafe',
    base: '#020a0f',
    layers: [
      {
        background: 'radial-gradient(ellipse 40% 45% at 25% 35%, rgba(34,211,238,0.8) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 35% 40% at 65% 55%, rgba(6,182,212,0.6) 0%, transparent 60%)',
        blendMode: 'screen',
        blur: 50,
      },
      {
        background: 'radial-gradient(ellipse 25% 30% at 75% 25%, rgba(165,243,252,0.4) 0%, transparent 55%)',
        blendMode: 'screen',
        blur: 40,
      },
      {
        background: 'radial-gradient(ellipse 20% 22% at 45% 80%, rgba(103,232,249,0.3) 0%, transparent 50%)',
        blendMode: 'screen',
        blur: 35,
      },
    ],
  },

  {
    id: 'nebula-witch-brew',
    name: "Witch's Brew",
    category: 'nebula',
    mood: 'vivid',
    desc: 'Toxic green bubbles rising from a cauldron of stars',
    dark: true,
    text: '#bef264',
    base: '#050a00',
    layers: [
      {
        background: 'radial-gradient(ellipse 42% 48% at 35% 40%, rgba(132,204,22,0.85) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 38% 42% at 70% 50%, rgba(101,163,13,0.7) 0%, transparent 60%)',
        blendMode: 'screen',
        blur: 50,
      },
      {
        background: 'radial-gradient(ellipse 28% 32% at 55% 75%, rgba(163,230,53,0.5) 0%, transparent 55%)',
        blendMode: 'screen',
        blur: 45,
      },
      {
        background: 'radial-gradient(ellipse 18% 20% at 20% 25%, rgba(190,242,100,0.35) 0%, transparent 50%)',
        blendMode: 'screen',
        blur: 30,
      },
    ],
  },

  {
    id: 'nebula-blood-moon',
    name: 'Blood Moon',
    category: 'nebula',
    mood: 'dark',
    desc: 'Crimson lunar eclipses casting long shadows through dust',
    dark: true,
    text: '#fecaca',
    base: '#0a0000',
    layers: [
      {
        background: 'radial-gradient(ellipse 48% 52% at 40% 45%, rgba(220,38,38,0.9) 0%, transparent 60%)',
        blendMode: 'screen',
        blur: 60,
      },
      {
        background: 'radial-gradient(ellipse 35% 40% at 70% 35%, rgba(153,27,27,0.7) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 30% 35% at 25% 70%, rgba(239,68,68,0.5) 0%, transparent 55%)',
        blendMode: 'screen',
        blur: 45,
      },
      {
        background: 'radial-gradient(ellipse 22% 25% at 60% 80%, rgba(185,28,28,0.4) 0%, transparent 60%)',
        blendMode: 'screen',
        blur: 35,
      },
    ],
  },

  {
    id: 'nebula-cobalt-dream',
    name: 'Cobalt Dream',
    category: 'nebula',
    mood: 'cool',
    desc: 'Deep blue orbs suspended in midnight ink',
    dark: true,
    text: '#bfdbfe',
    base: '#020617',
    layers: [
      {
        background: 'radial-gradient(ellipse 42% 48% at 30% 40%, rgba(37,99,235,0.85) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 38% 42% at 70% 50%, rgba(29,78,216,0.7) 0%, transparent 60%)',
        blendMode: 'screen',
        blur: 50,
      },
      {
        background: 'radial-gradient(ellipse 28% 32% at 55% 75%, rgba(59,130,246,0.5) 0%, transparent 55%)',
        blendMode: 'screen',
        blur: 45,
      },
      {
        background: 'radial-gradient(ellipse 18% 20% at 20% 25%, rgba(96,165,250,0.3) 0%, transparent 50%)',
        blendMode: 'screen',
        blur: 35,
      },
    ],
  },

  {
    id: 'nebula-smoke-signal',
    name: 'Smoke Signal',
    category: 'nebula',
    mood: 'dark',
    desc: 'Gray smoke rings drifting from an extinguished star',
    dark: true,
    text: '#e5e7eb',
    base: '#0a0a0a',
    layers: [
      {
        background: 'radial-gradient(ellipse 45% 50% at 35% 40%, rgba(75,85,99,0.6) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 40,
      },
      {
        background: 'radial-gradient(ellipse 38% 42% at 70% 50%, rgba(55,65,81,0.5) 0%, transparent 60%)',
        blendMode: 'screen',
        blur: 30,
      },
      {
        background: 'radial-gradient(ellipse 28% 32% at 55% 75%, rgba(107,114,128,0.35) 0%, transparent 55%)',
        blendMode: 'screen',
        blur: 25,
      },
      {
        background: 'radial-gradient(ellipse 20% 22% at 20% 25%, rgba(156,163,175,0.25) 0%, transparent 50%)',
        blendMode: 'screen',
        blur: 15,
      },
    ],
  },

  {
    id: 'nebula-coral-reef',
    name: 'Coral Reef',
    category: 'nebula',
    mood: 'vivid',
    desc: 'Living coral polyps glowing in abyssal currents',
    dark: true,
    text: '#fed7aa',
    base: '#0a0400',
    layers: [
      {
        background: 'radial-gradient(ellipse 42% 48% at 30% 40%, rgba(249,115,22,0.8) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 36% 40% at 70% 50%, rgba(244,63,94,0.65) 0%, transparent 60%)',
        blendMode: 'screen',
        blur: 50,
      },
      {
        background: 'radial-gradient(ellipse 28% 32% at 50% 75%, rgba(251,146,60,0.45) 0%, transparent 55%)',
        blendMode: 'screen',
        blur: 45,
      },
      {
        background: 'radial-gradient(ellipse 18% 20% at 80% 30%, rgba(255,107,107,0.3) 0%, transparent 50%)',
        blendMode: 'screen',
        blur: 35,
      },
    ],
  },

  {
    id: 'nebula-thunder-storm',
    name: 'Thunder Storm',
    category: 'nebula',
    mood: 'dark',
    desc: 'Electric violet thunderheads rolling through void',
    dark: true,
    text: '#ddd6fe',
    base: '#050510',
    layers: [
      {
        background: 'radial-gradient(ellipse 48% 52% at 40% 45%, rgba(91,33,182,0.85) 0%, transparent 60%)',
        blendMode: 'screen',
        blur: 60,
      },
      {
        background: 'radial-gradient(ellipse 35% 40% at 70% 35%, rgba(76,29,149,0.7) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 30% 35% at 25% 70%, rgba(124,58,237,0.5) 0%, transparent 55%)',
        blendMode: 'screen',
        blur: 45,
      },
      {
        background: 'radial-gradient(ellipse 22% 25% at 60% 80%, rgba(139,92,246,0.35) 0%, transparent 60%)',
        blendMode: 'screen',
        blur: 35,
      },
    ],
  },

  {
    id: 'nebula-midnight-rose',
    name: 'Midnight Rose',
    category: 'nebula',
    mood: 'dark',
    desc: 'Deep burgundy petals unfurling in eternal darkness',
    dark: true,
    text: '#fbcfe8',
    base: '#0a0005',
    layers: [
      {
        background: 'radial-gradient(ellipse 42% 48% at 35% 40%, rgba(159,18,57,0.85) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 38% 42% at 70% 50%, rgba(190,18,60,0.7) 0%, transparent 60%)',
        blendMode: 'screen',
        blur: 50,
      },
      {
        background: 'radial-gradient(ellipse 28% 32% at 55% 75%, rgba(219,39,119,0.5) 0%, transparent 55%)',
        blendMode: 'screen',
        blur: 45,
      },
      {
        background: 'radial-gradient(ellipse 18% 20% at 20% 25%, rgba(244,114,182,0.3) 0%, transparent 50%)',
        blendMode: 'screen',
        blur: 35,
      },
    ],
  },

  {
    id: 'nebula-neon-sludge',
    name: 'Neon Sludge',
    category: 'nebula',
    mood: 'vivid',
    desc: 'Toxic waste orbs glowing with unnatural intensity',
    dark: true,
    text: '#86efac',
    base: '#001a00',
    layers: [
      {
        background: 'radial-gradient(ellipse 42% 48% at 30% 40%, rgba(34,197,94,0.9) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 36% 40% at 70% 50%, rgba(22,163,74,0.75) 0%, transparent 60%)',
        blendMode: 'screen',
        blur: 50,
      },
      {
        background: 'radial-gradient(ellipse 28% 32% at 50% 75%, rgba(74,222,128,0.55) 0%, transparent 55%)',
        blendMode: 'screen',
        blur: 45,
      },
      {
        background: 'radial-gradient(ellipse 18% 20% at 80% 30%, rgba(134,239,172,0.35) 0%, transparent 50%)',
        blendMode: 'screen',
        blur: 35,
      },
    ],
  },

  {
    id: 'nebula-supernova',
    name: 'Supernova',
    category: 'nebula',
    mood: 'warm',
    desc: 'Explosive amber and crimson orbs',
    dark: false,
    cardText: '#000000',
    text: '#ffecd2',
    base: '#0a0502',
    layers: [
      {
        background: 'radial-gradient(ellipse 45% 55% at 40% 45%, rgba(245,158,11,0.9) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 60,
      },
      {
        background: 'radial-gradient(ellipse 30% 40% at 70% 35%, rgba(239,68,68,0.7) 0%, transparent 70%)',
        blendMode: 'screen',
        blur: 50,
      },
      {
        background: 'radial-gradient(ellipse 35% 35% at 25% 70%, rgba(251,146,60,0.6) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 45,
      },
      {
        background: 'radial-gradient(ellipse 20% 20% at 60% 75%, rgba(220,38,38,0.4) 0%, transparent 70%)',
        blendMode: 'screen',
        blur: 35,
      },
    ],
  },

  {
    id: 'nebula-mint-cloud',
    name: 'Mint Cloud',
    category: 'nebula',
    mood: 'cool',
    desc: 'Ethereal teal and emerald floating spheres',
    dark: false,
    cardText: '#000000',
    text: '#064e3b',
    base: '#ecfdf5',
    layers: [
      {
        background: 'radial-gradient(ellipse 40% 45% at 30% 40%, rgba(52,211,153,0.7) 0%, transparent 65%)',
        blendMode: 'normal',
        blur: 60,
      },
      {
        background: 'radial-gradient(ellipse 35% 40% at 65% 55%, rgba(20,184,166,0.5) 0%, transparent 60%)',
        blendMode: 'normal',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 25% 30% at 75% 25%, rgba(110,231,183,0.4) 0%, transparent 55%)',
        blendMode: 'normal',
        blur: 50,
      },
    ],
  },

  {
    id: 'nebula-rose-quartz',
    name: 'Rose Quartz',
    category: 'nebula',
    mood: 'warm',
    desc: 'Delicate pink and blush floating orbs',
    dark: false,
    cardText: '#000000',
    text: '#831843',
    base: '#fff1f2',
    layers: [
      {
        background: 'radial-gradient(ellipse 45% 50% at 35% 45%, rgba(251,113,133,0.6) 0%, transparent 60%)',
        blendMode: 'normal',
        blur: 65,
      },
      {
        background: 'radial-gradient(ellipse 30% 35% at 70% 35%, rgba(244,114,182,0.5) 0%, transparent 55%)',
        blendMode: 'normal',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 35% 40% at 55% 75%, rgba(253,164,175,0.4) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 60,
      },
    ],
  },

  {
    id: 'nebula-peach-velvet',
    name: 'Peach Velvet',
    category: 'nebula',
    mood: 'warm',
    desc: 'Soft peach fuzz orbs floating in cream',
    dark: false,
    cardText: '#000000',
    text: '#9a3412',
    base: '#fff7ed',
    layers: [
      {
        background: 'radial-gradient(ellipse 45% 50% at 30% 40%, rgba(251,146,60,0.6) 0%, transparent 60%)',
        blendMode: 'normal',
        blur: 65,
      },
      {
        background: 'radial-gradient(ellipse 35% 40% at 70% 35%, rgba(253,186,116,0.5) 0%, transparent 55%)',
        blendMode: 'normal',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 30% 35% at 50% 75%, rgba(249,115,22,0.35) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 50,
      },
      {
        background: 'radial-gradient(ellipse 20% 22% at 80% 65%, rgba(255,237,213,0.5) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 40,
      },
    ],
  },

  {
    id: 'nebula-lavender-fields',
    name: 'Lavender Fields',
    category: 'nebula',
    mood: 'cool',
    desc: 'Soft violet spheres blooming in twilight',
    dark: false,
    cardText: '#000000',
    text: '#581c87',
    base: '#faf5ff',
    layers: [
      {
        background: 'radial-gradient(ellipse 45% 50% at 30% 40%, rgba(192,132,252,0.55) 0%, transparent 60%)',
        blendMode: 'normal',
        blur: 65,
      },
      {
        background: 'radial-gradient(ellipse 35% 40% at 70% 35%, rgba(168,85,247,0.45) 0%, transparent 55%)',
        blendMode: 'normal',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 30% 35% at 50% 75%, rgba(216,180,254,0.35) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 50,
      },
      {
        background: 'radial-gradient(ellipse 20% 22% at 80% 65%, rgba(233,213,255,0.4) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 40,
      },
    ],
  },

  {
    id: 'nebula-sand-dunes',
    name: 'Sand Dunes',
    category: 'nebula',
    mood: 'warm',
    desc: 'Desert mirages of heated air bending starlight',
    dark: false,
    cardText: '#000000',
    text: '#713f12',
    base: '#fefce8',
    layers: [
      {
        background: 'radial-gradient(ellipse 45% 50% at 30% 40%, rgba(234,179,8,0.5) 0%, transparent 60%)',
        blendMode: 'normal',
        blur: 65,
      },
      {
        background: 'radial-gradient(ellipse 35% 40% at 70% 35%, rgba(202,138,4,0.4) 0%, transparent 55%)',
        blendMode: 'normal',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 30% 35% at 50% 75%, rgba(217,119,6,0.3) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 50,
      },
      {
        background: 'radial-gradient(ellipse 20% 22% at 80% 65%, rgba(251,191,36,0.25) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 40,
      },
    ],
  },

  {
    id: 'nebula-champagne-bubbles',
    name: 'Champagne Bubbles',
    category: 'nebula',
    mood: 'warm',
    desc: 'Effervescent gold spheres rising through crystal',
    dark: false,
    cardText: '#000000',
    text: '#78350f',
    base: '#fffbeb',
    layers: [
      {
        background: 'radial-gradient(ellipse 40% 45% at 30% 40%, rgba(251,191,36,0.5) 0%, transparent 60%)',
        blendMode: 'normal',
        blur: 65,
      },
      {
        background: 'radial-gradient(ellipse 35% 38% at 65% 55%, rgba(253,224,71,0.4) 0%, transparent 55%)',
        blendMode: 'normal',
        blur: 60,
      },
      {
        background: 'radial-gradient(ellipse 25% 28% at 75% 25%, rgba(234,179,8,0.35) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 50,
      },
      {
        background: 'radial-gradient(ellipse 20% 22% at 45% 80%, rgba(254,240,138,0.4) 0%, transparent 45%)',
        blendMode: 'normal',
        blur: 40,
      },
    ],
  },

  {
    id: 'prism-crystal-edge',
    name: 'Crystal Edge',
    category: 'prism',
    mood: 'cool',
    desc: 'Angular prism refraction with blue-violet',
    dark: false,
    cardText: '#ffffff',
    text: '#1e1b4b',
    base: '#f5f3ff',
    layers: [
      {
        background: 'conic-gradient(from 135deg at 30% 40%, #818cf8, #c084fc, #f0abfc, #93c5fd, #818cf8)',
        blendMode: 'soft-light',
        blur: 60,
      },
      {
        background: 'conic-gradient(from 315deg at 70% 60%, #a78bfa, #67e8f9, #86efac, #a78bfa)',
        blendMode: 'soft-light',
        blur: 70,
      },
    ],
  },

  {
    id: 'prism-solar-flare',
    name: 'Solar Flare',
    category: 'prism',
    mood: 'warm',
    desc: 'Warm conic burst from golden core',
    dark: false,
    cardText: '#ffffff',
    text: '#fef3c7',
    base: '#0c0502',
    layers: [
      {
        background: 'conic-gradient(from 90deg at 50% 65%, #f59e0b, #ef4444, #f97316, #fbbf24, #f59e0b)',
        blendMode: 'screen',
        blur: 80,
      },
      {
        background: 'radial-gradient(circle at 50% 60%, rgba(251,191,36,0.4) 0%, transparent 45%)',
        blendMode: 'screen',
        blur: 50,
      },
    ],
  },

  {
    id: 'grain-midnight-film',
    name: 'Midnight Film',
    category: 'grain',
    mood: 'cool',
    desc: 'Deep indigo with analog film grain',
    dark: true,
    text: '#c7d2fe',
    base: '#0f0a1e',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 70%, #6366f1 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(circle at 60% 40%, rgba(129,140,248,0.3) 0%, transparent 50%)',
        blendMode: 'screen',
        blur: 40,
      },
    ],
  },

  {
    id: 'grain-warm-velvet',
    name: 'Warm Velvet',
    category: 'grain',
    mood: 'warm',
    desc: 'Rich burgundy with soft texture',
    dark: true,
    text: '#fecdd3',
    base: '#1a0505',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(145deg, #450a0a 0%, #7f1d1d 35%, #991b1b 60%, #b91c1c 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(circle at 40% 50%, rgba(252,165,165,0.2) 0%, transparent 50%)',
        blendMode: 'screen',
        blur: 50,
      },
    ],
  },

  {
    id: 'grain-forest-mist',
    name: 'Forest Mist',
    category: 'grain',
    mood: 'cool',
    desc: 'Emerald depth with organic noise',
    dark: true,
    text: '#d1fae5',
    base: '#022c22',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(140deg, #022c22 0%, #064e3b 35%, #065f46 60%, #047857 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(circle at 55% 45%, rgba(52,211,153,0.25) 0%, transparent 50%)',
        blendMode: 'screen',
        blur: 45,
      },
    ],
  },

  {
    id: 'grain-cosmic-ash',
    name: 'Cosmic Ash',
    category: 'grain',
    mood: 'cool',
    desc: 'Charcoal and indigo grain over a subtle violet undertone',
    dark: true,
    text: '#d6d0f0',
    base: '#0d0b16',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(140deg, #0d0b16 0%, #1e1b32 40%, #312e4d 70%, #433f68 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(circle at 55% 40%, rgba(129,140,248,0.25) 0%, transparent 50%)',
        blendMode: 'screen',
        blur: 45,
      },
    ],
  },

  {
    id: 'grain-obsidian',
    name: 'Obsidian',
    category: 'grain',
    mood: 'cool',
    desc: 'Black volcanic depth with subtle graphite texture',
    dark: true,
    text: '#d4d4d8',
    base: '#050505',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(135deg, #030303 0%, #111111 42%, #1c1c1c 72%, #090909 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(ellipse 45% 55% at 68% 38%, rgba(161,161,170,0.16) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 5,
      },
    ],
  },

  {
    id: 'grain-ocean-depth',
    name: 'Ocean Depth',
    category: 'grain',
    mood: 'cool',
    desc: 'Deep marine blue with soft underwater illumination',
    dark: true,
    text: '#c7f9ff',
    base: '#020b12',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(145deg, #020b12 0%, #073047 38%, #075985 68%, #0e7490 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background:
          'radial-gradient(ellipse 55% 40% at 58% 38%, rgba(34,211,238,0.24) 0%, rgba(14,116,144,0.10) 48%, transparent 75%)',
        blendMode: 'screen',
        blur: 50,
      },
    ],
  },

  {
    id: 'grain-moss',
    name: 'Moss',
    category: 'grain',
    mood: 'cool',
    desc: 'Muted moss green with earthy photographic texture',
    dark: true,
    text: '#d9f2c7',
    base: '#11150d',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(150deg, #11150d 0%, #283618 40%, #3f6212 68%, #4d7c0f 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background:
          'radial-gradient(ellipse 48% 42% at 42% 46%, rgba(163,230,53,0.18) 0%, rgba(101,163,13,0.08) 48%, transparent 75%)',
        blendMode: 'screen',
        blur: 48,
      },
    ],
  },

  {
    id: 'grain-smoked-lilac',
    name: 'Smoked Lilac',
    category: 'grain',
    mood: 'cool',
    desc: 'Dusty violet softened by a smoky analog texture',
    dark: true,
    text: '#e9d5ff',
    base: '#100c16',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(140deg, #100c16 0%, #24162e 38%, #4c1d62 68%, #6b3578 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background:
          'radial-gradient(ellipse 50% 45% at 62% 40%, rgba(216,180,254,0.20) 0%, rgba(168,85,247,0.08) 48%, transparent 75%)',
        blendMode: 'screen',
        blur: 45,
      },
    ],
  },

  {
    id: 'grain-olive-film',
    name: 'Olive Film',
    category: 'grain',
    mood: 'warm',
    desc: 'Muted olive tones inspired by vintage photography',
    dark: true,
    text: '#e7e5b5',
    base: '#15160b',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(145deg, #15160b 0%, #3f4220 40%, #686b2a 70%, #85852f 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(ellipse 55% 45% at 48% 42%, rgba(217,219,121,0.16) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 48,
      },
    ],
  },

  {
    id: 'grain-carbon-blue',
    name: 'Carbon Blue',
    category: 'grain',
    mood: 'cool',
    desc: 'Charcoal black transitioning into restrained cobalt blue',
    dark: true,
    text: '#bfdbfe',
    base: '#05070c',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(138deg, #05070c 0%, #0f172a 40%, #172554 70%, #1e3a8a 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(ellipse 45% 50% at 72% 40%, rgba(96,165,250,0.20) 0%, transparent 68%)',
        blendMode: 'screen',
        blur: 42,
      },
    ],
  },

  {
    id: 'grain-rainforest',
    name: 'Rainforest',
    category: 'grain',
    mood: 'cool',
    desc: 'Dense tropical green with humid atmospheric texture',
    dark: true,
    text: '#ccfbf1',
    base: '#02100c',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(142deg, #02100c 0%, #064e3b 35%, #047857 62%, #059669 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background:
          'radial-gradient(ellipse 50% 55% at 65% 38%, rgba(45,212,191,0.20) 0%, rgba(16,185,129,0.08) 50%, transparent 78%)',
        blendMode: 'screen',
        blur: 48,
      },
    ],
  },

  {
    id: 'grain-burnt-paper',
    name: 'Burnt Paper',
    category: 'grain',
    mood: 'warm',
    desc: 'Aged parchment fading into warm charcoal',
    dark: true,
    text: '#fed7aa',
    base: '#17100b',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(140deg, #29150b 0%, #78350f 38%, #a16207 66%, #d97706 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(ellipse 50% 45% at 45% 40%, rgba(254,215,170,0.16) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 45,
      },
    ],
  },

  {
    id: 'grain-indigo-haze',
    name: 'Indigo Haze',
    category: 'grain',
    mood: 'cool',
    desc: 'Soft midnight indigo with a hazy luminous center',
    dark: true,
    text: '#c7d2fe',
    base: '#080914',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(145deg, #080914 0%, #171853 38%, #312e81 68%, #4338ca 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background:
          'radial-gradient(ellipse 55% 45% at 52% 45%, rgba(165,180,252,0.20) 0%, rgba(99,102,241,0.08) 50%, transparent 76%)',
        blendMode: 'screen',
        blur: 50,
      },
    ],
  },

  {
    id: 'grain-smoke',
    name: 'Smoke',
    category: 'grain',
    mood: 'cool',
    desc: 'Neutral graphite gradient with dense atmospheric grain',
    dark: true,
    text: '#e4e4e7',
    base: '#080808',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(145deg, #050505 0%, #18181b 42%, #27272a 68%, #3f3f46 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(ellipse 58% 50% at 48% 44%, rgba(228,228,231,0.12) 0%, transparent 68%)',
        blendMode: 'screen',
        blur: 52,
      },
    ],
  },

  {
    id: 'grain-lunar-surface',
    name: 'Lunar Surface',
    category: 'grain',
    mood: 'cool',
    desc: 'Cold lunar gray with subtle mineral depth',
    dark: true,
    text: '#e5e7eb',
    base: '#0c0d0f',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(150deg, #090a0c 0%, #27272a 40%, #52525b 68%, #71717a 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(ellipse 45% 50% at 60% 38%, rgba(212,212,216,0.18) 0%, transparent 68%)',
        blendMode: 'screen',
        blur: 45,
      },
    ],
  },

  {
    id: 'grain-desert-sand',
    name: 'Desert Sand',
    category: 'grain',
    mood: 'warm',
    desc: 'Warm beige with gritty film texture',
    dark: false,
    cardText: '#000000',
    text: '#78350f',
    base: '#fefce8',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(155deg, #fef9c3 0%, #fde68a 40%, #fcd34d 70%, #fbbf24 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(circle at 50% 40%, rgba(245,158,11,0.2) 0%, transparent 55%)',
        blendMode: 'soft-light',
        blur: 30,
      },
    ],
  },

  {
    id: 'grain-concrete',
    name: 'Concrete Grain',
    category: 'grain',
    mood: 'cool',
    desc: 'Cool concrete gray with fine analog texture',
    dark: false,
    cardText: '#000000',
    text: '#3f3f46',
    base: '#f4f4f5',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(150deg, #e4e4e7 0%, #d4d4d8 40%, #a1a1aa 70%, #71717a 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(circle at 50% 40%, rgba(113,113,122,0.2) 0%, transparent 55%)',
        blendMode: 'soft-light',
        blur: 30,
      },
    ],
  },

  {
    id: 'grain-arctic-paper',
    name: 'Arctic Paper',
    category: 'grain',
    mood: 'cool',
    desc: 'Cold white surface with a delicate icy texture',
    dark: false,
    cardText: '#000000',
    text: '#334155',
    base: '#f8fafc',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(145deg, #f8fafc 0%, #e0f2fe 38%, #bae6fd 68%, #dbeafe 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(ellipse 50% 40% at 35% 42%, rgba(125,211,252,0.22) 0%, transparent 60%)',
        blendMode: 'soft-light',
        blur: 35,
      },
    ],
  },

  {
    id: 'grain-terracotta',
    name: 'Terracotta',
    category: 'grain',
    mood: 'warm',
    desc: 'Burnt clay with warm tactile grain',
    dark: false,
    cardText: '#000000',
    text: '#7c2d12',
    base: '#fff7ed',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(145deg, #fed7aa 0%, #f97316 38%, #c2410c 68%, #9a3412 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(ellipse 48% 42% at 40% 45%, rgba(255,237,213,0.22) 0%, transparent 60%)',
        blendMode: 'soft-light',
        blur: 38,
      },
    ],
  },

  {
    id: 'grain-champagne',
    name: 'Champagne',
    category: 'grain',
    mood: 'warm',
    desc: 'Soft champagne surface with understated luxury texture',
    dark: false,
    cardText: '#000000',
    text: '#713f12',
    base: '#fffbeb',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(145deg, #fffbeb 0%, #fef3c7 38%, #fde68a 68%, #fcd34d 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(ellipse 55% 40% at 55% 38%, rgba(255,255,255,0.42) 0%, transparent 65%)',
        blendMode: 'soft-light',
        blur: 32,
      },
    ],
  },

  {
    id: 'grain-dusty-rose',
    name: 'Dusty Rose',
    category: 'grain',
    mood: 'warm',
    desc: 'Muted rose gradient with soft vintage film character',
    dark: false,
    cardText: '#ffffff',
    text: '#881337',
    base: '#fff1f2',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(145deg, #ffe4e6 0%, #fda4af 38%, #fb7185 68%, #e11d48 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(ellipse 48% 45% at 40% 42%, rgba(255,255,255,0.25) 0%, transparent 62%)',
        blendMode: 'soft-light',
        blur: 40,
      },
    ],
  },

  {
    id: 'grain-frosted-slate',
    name: 'Frosted Slate',
    category: 'grain',
    mood: 'cool',
    desc: 'Desaturated blue-gray with soft frosted texture',
    dark: false,
    cardText: '#000000',
    text: '#334155',
    base: '#f1f5f9',
    grain: true,
    layers: [
      {
        background: 'linear-gradient(145deg, #e2e8f0 0%, #cbd5e1 38%, #94a3b8 68%, #64748b 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(ellipse 50% 42% at 58% 40%, rgba(226,232,240,0.30) 0%, transparent 62%)',
        blendMode: 'soft-light',
        blur: 35,
      },
    ],
  },

  {
    id: 'glass-arctic-frost',
    name: 'Arctic Frost',
    category: 'glass',
    mood: 'cool',
    desc: 'Frosted glass with blue-cyan refraction',
    dark: false,
    cardText: '#000000',
    text: '#164e63',
    base: '#ecfeff',
    layers: [
      {
        background:
          'linear-gradient(135deg, rgba(207,250,254,0.9) 0%, rgba(165,243,252,0.4) 50%, rgba(34,211,238,0.3) 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(circle at 30% 30%, rgba(6,182,212,0.5) 0%, transparent 40%)',
        blendMode: 'overlay',
        blur: 50,
      },
      {
        background: 'radial-gradient(circle at 70% 70%, rgba(14,165,233,0.4) 0%, transparent 35%)',
        blendMode: 'overlay',
        blur: 60,
      },
      {
        background:
          'linear-gradient(45deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.4) 100%)',
        blendMode: 'soft-light',
        blur: 20,
      },
    ],
  },

  {
    id: 'glass-rose-window',
    name: 'Rose Window',
    category: 'glass',
    mood: 'warm',
    desc: 'Stained glass with rose and amber refractions',
    dark: false,
    cardText: '#000000',
    text: '#881337',
    base: '#fff1f2',
    layers: [
      {
        background:
          'linear-gradient(135deg, rgba(255,228,230,0.9) 0%, rgba(254,205,211,0.5) 50%, rgba(252,165,165,0.3) 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(circle at 35% 40%, rgba(244,63,94,0.4) 0%, transparent 35%)',
        blendMode: 'overlay',
        blur: 55,
      },
      {
        background: 'radial-gradient(circle at 65% 55%, rgba(251,146,60,0.35) 0%, transparent 30%)',
        blendMode: 'overlay',
        blur: 50,
      },
      {
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.3) 100%)',
        blendMode: 'soft-light',
        blur: 15,
      },
    ],
  },

  {
    id: 'glass-ice-sheet',
    name: 'Ice Sheet',
    category: 'glass',
    mood: 'cool',
    desc: 'Layered translucent ice with frozen cyan fractures',
    dark: false,
    cardText: '#000000',
    text: '#164e63',
    base: '#f0f9ff',
    layers: [
      {
        background:
          'linear-gradient(135deg, rgba(224,242,254,0.95) 0%, rgba(186,230,253,0.62) 50%, rgba(125,211,252,0.38) 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background:
          'linear-gradient(115deg, transparent 20%, rgba(6,182,212,0.18) 38%, transparent 42%, rgba(56,189,248,0.22) 62%, transparent 76%)',
        blendMode: 'overlay',
        blur: 18,
      },
      {
        background: 'radial-gradient(ellipse 45% 55% at 25% 35%, rgba(255,255,255,0.60) 0%, transparent 65%)',
        blendMode: 'screen',
        blur: 35,
      },
      {
        background:
          'linear-gradient(35deg, rgba(255,255,255,0.55), transparent 35%, rgba(255,255,255,0.25) 65%, transparent)',
        blendMode: 'soft-light',
        blur: 15,
      },
    ],
  },

  {
    id: 'glass-aqua-bubble',
    name: 'Aqua Bubble',
    category: 'glass',
    mood: 'cool',
    desc: 'Soft translucent bubbles suspended in an aquatic glass surface',
    dark: false,
    cardText: '#000000',
    text: '#155e75',
    base: '#ecfeff',
    layers: [
      {
        background:
          'radial-gradient(circle at 25% 40%, rgba(34,211,238,0.34) 0%, rgba(103,232,249,0.12) 32%, transparent 55%), radial-gradient(circle at 72% 58%, rgba(14,165,233,0.28) 0%, rgba(125,211,252,0.10) 34%, transparent 58%)',
        blendMode: 'normal',
        blur: 25,
      },
      {
        background: 'radial-gradient(circle at 25% 40%, rgba(255,255,255,0.65) 0%, transparent 12%)',
        blendMode: 'screen',
        blur: 12,
      },
      {
        background: 'radial-gradient(circle at 72% 58%, rgba(255,255,255,0.55) 0%, transparent 13%)',
        blendMode: 'screen',
        blur: 14,
      },
      {
        background: 'linear-gradient(135deg, rgba(255,255,255,0.42) 0%, transparent 45%, rgba(6,182,212,0.12) 100%)',
        blendMode: 'soft-light',
        blur: 20,
      },
    ],
  },

  {
    id: 'glass-champagne',
    name: 'Champagne Glass',
    category: 'glass',
    mood: 'warm',
    desc: 'Soft golden translucent glass with luxurious highlights',
    dark: false,
    cardText: '#000000',
    text: '#713f12',
    base: '#fffbeb',
    layers: [
      {
        background:
          'linear-gradient(135deg, rgba(255,251,235,0.95) 0%, rgba(254,243,199,0.62) 50%, rgba(253,230,138,0.34) 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(ellipse 50% 45% at 32% 42%, rgba(251,191,36,0.26) 0%, transparent 68%)',
        blendMode: 'overlay',
        blur: 50,
      },
      {
        background: 'radial-gradient(ellipse 42% 50% at 72% 60%, rgba(245,158,11,0.20) 0%, transparent 70%)',
        blendMode: 'overlay',
        blur: 55,
      },
      {
        background: 'linear-gradient(120deg, rgba(255,255,255,0.65), transparent 42%, rgba(255,255,255,0.30) 72%)',
        blendMode: 'soft-light',
        blur: 18,
      },
    ],
  },

  {
    id: 'glass-frosted-mint',
    name: 'Frosted Mint',
    category: 'glass',
    mood: 'cool',
    desc: 'Pale mint glass with a soft frozen atmospheric glow',
    dark: false,
    cardText: '#000000',
    text: '#065f46',
    base: '#f0fdf4',
    layers: [
      {
        background:
          'linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(167,243,208,0.58) 50%, rgba(110,231,183,0.30) 100%)',
        blendMode: 'normal',
        blur: 0,
      },
      {
        background: 'radial-gradient(ellipse 50% 45% at 30% 40%, rgba(52,211,153,0.26) 0%, transparent 68%)',
        blendMode: 'overlay',
        blur: 52,
      },
      {
        background: 'radial-gradient(ellipse 45% 50% at 72% 60%, rgba(45,212,191,0.20) 0%, transparent 70%)',
        blendMode: 'overlay',
        blur: 55,
      },
      {
        background: 'linear-gradient(120deg, rgba(255,255,255,0.62) 0%, transparent 45%, rgba(255,255,255,0.32) 100%)',
        blendMode: 'soft-light',
        blur: 18,
      },
    ],
  },

  {
    id: 'flux-bubblegum',
    name: 'Bubblegum',
    category: 'flux',
    mood: 'vivid',
    desc: 'Playful pink, purple and mint blob composition',
    dark: false,
    cardText: '#000000',
    text: '#701a75',
    base: '#fdf4ff',
    layers: [
      {
        background: 'radial-gradient(ellipse 50% 45% at 25% 40%, rgba(236,72,153,0.65) 0%, transparent 65%)',
        blendMode: 'normal',
        blur: 50,
      },
      {
        background: 'radial-gradient(ellipse 40% 50% at 70% 55%, rgba(168,85,247,0.55) 0%, transparent 60%)',
        blendMode: 'normal',
        blur: 55,
      },
      {
        background: 'radial-gradient(ellipse 35% 40% at 50% 25%, rgba(52,211,153,0.45) 0%, transparent 55%)',
        blendMode: 'normal',
        blur: 45,
      },
      {
        background: 'radial-gradient(ellipse 30% 30% at 80% 30%, rgba(244,114,182,0.4) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 40,
      },
    ],
  },

  {
    id: 'flux-cloud-nine',
    name: 'Cloud Nine',
    category: 'flux',
    mood: 'warm',
    desc: 'Soft peach and cream organic cloudscape',
    dark: false,
    cardText: '#000000',
    text: '#9a3412',
    base: '#fff7ed',
    layers: [
      {
        background: 'radial-gradient(ellipse 55% 45% at 30% 50%, rgba(253,186,116,0.6) 0%, transparent 60%)',
        blendMode: 'normal',
        blur: 60,
      },
      {
        background: 'radial-gradient(ellipse 45% 55% at 65% 40%, rgba(251,146,60,0.45) 0%, transparent 55%)',
        blendMode: 'normal',
        blur: 65,
      },
      {
        background: 'radial-gradient(ellipse 40% 35% at 50% 70%, rgba(254,215,170,0.5) 0%, transparent 50%)',
        blendMode: 'normal',
        blur: 55,
      },
    ],
  },

  {
    id: 'flux-milk-tea',
    name: 'Milk Tea',
    category: 'flux',
    mood: 'warm',
    desc: 'Creamy caramel and beige organic forms with a soft tactile feel',
    dark: false,
    cardText: '#000000',
    text: '#78350f',
    base: '#fffbeb',
    layers: [
      {
        background:
          'radial-gradient(ellipse 55% 45% at 30% 50%, rgba(217,119,6,0.38) 0%, rgba(245,158,11,0.12) 48%, transparent 72%)',
        blendMode: 'normal',
        blur: 58,
      },
      {
        background:
          'radial-gradient(ellipse 45% 52% at 68% 40%, rgba(180,83,9,0.28) 0%, rgba(217,119,6,0.08) 50%, transparent 74%)',
        blendMode: 'normal',
        blur: 62,
      },
      {
        background: 'radial-gradient(ellipse 30% 28% at 50% 72%, rgba(255,255,255,0.62) 0%, transparent 68%)',
        blendMode: 'soft-light',
        blur: 38,
      },
    ],
  },

  {
    id: 'flux-sage-smoke',
    name: 'Sage Smoke',
    category: 'flux',
    mood: 'cool',
    desc: 'Muted sage and eucalyptus shapes drifting through pale air',
    dark: false,
    cardText: '#000000',
    text: '#365314',
    base: '#f5f7f0',
    layers: [
      {
        background:
          'radial-gradient(ellipse 55% 48% at 30% 48%, rgba(132,204,22,0.34) 0%, rgba(101,163,13,0.08) 48%, transparent 72%)',
        blendMode: 'normal',
        blur: 40,
      },
      {
        background:
          'radial-gradient(ellipse 46% 52% at 68% 42%, rgba(45,212,191,0.28) 0%, rgba(20,184,166,0.06) 50%, transparent 74%)',
        blendMode: 'normal',
        blur: 30,
      },
      {
        background: 'radial-gradient(ellipse 32% 30% at 52% 70%, rgba(255,255,255,0.50) 0%, transparent 68%)',
        blendMode: 'soft-light',
        blur: 30,
      },
    ],
  },

  {
    id: 'aurora-beams',
    name: 'Aurora Beams',
    category: 'lattice',
    mood: 'cool',
    desc: 'Diagonal repeating light beams heavily blurred with a teal base glow',
    dark: true,
    text: '#ffffff',
    base: '#0a0a0a',
    grain: true,
    layers: [
      {
        background: 'radial-gradient(55.8% 55.49% at 50% 100%, rgb(38, 77, 76) 0%, rgba(25, 48, 47, 0) 100%)',
        blendMode: 'screen',
        blur: 0,
        opacity: 1,
      },

      {
        background: `
        repeating-linear-gradient(
          100deg,
          #262626 0%,
          #262626 3%,
          rgba(38, 38, 38, 0.7) 5%,
          rgba(38, 38, 38, 0.7) 7%,
          transparent 10%,
          transparent 12%,
          rgba(38, 38, 38, 0.7) 14%,
          #262626 16%
        ),
        repeating-linear-gradient(
          100deg,
          #9ca3af 0%,
          #9ca3af 1.5%,
          rgba(156, 163, 175, 0.8) 2%,
          #6b7280 3%,
          #6b7280 4%,
          rgba(156, 163, 175, 0.8) 4.5%,
          #9ca3af 5%
        )
      `,
        backgroundSize: '300% 200%',
        blendMode: 'screen',
        blur: 30,
        opacity: 0.9,
      },

      {
        background: 'radial-gradient(ellipse at 100% 100%, #ffffff 20%, #0a0a0a 80%)',
        blendMode: 'multiply',
        blur: 0,
        opacity: 1,
      },
    ],
  },

  {
    id: 'diamond-storm',
    name: 'Diamond Storm',
    category: 'lattice',
    mood: 'cool',
    desc: 'Electric ice beams cutting through a glacial void',
    dark: true,
    text: '#ffffff',
    base: '#00030a',
    grain: true,
    layers: [
      {
        background: 'radial-gradient(55.8% 55.49% at 50% 100%, rgb(20,60,120) 0%, rgba(10,30,80,0) 100%)',
        blendMode: 'screen',
        blur: 0,
        opacity: 1,
      },
      {
        background: `
          repeating-linear-gradient(
            100deg,
            #041022 0%,
            #041022 3%,
            rgba(20, 60, 120, 0.7) 5%,
            rgba(20, 60, 120, 0.7) 7%,
            transparent 10%,
            transparent 12%,
            rgba(20, 60, 120, 0.7) 14%,
            #041022 16%
          ),
          repeating-linear-gradient(
            100deg,
            #b3e5ff 0%,
            #b3e5ff 1.5%,
            rgba(179, 229, 255, 0.8) 2%,
            #2563eb 3%,
            #2563eb 4%,
            rgba(179, 229, 255, 0.8) 4.5%,
            #b3e5ff 5%
          )
        `,
        backgroundSize: '300% 200%',
        blendMode: 'screen',
        blur: 30,
        opacity: 0.9,
      },
      {
        background: 'radial-gradient(ellipse at 100% 100%, #ffffff 20%, #00030a 80%)',
        blendMode: 'multiply',
        blur: 0,
        opacity: 1,
      },
    ],
  },
]

/** Generate copyable CSS for a gradient (fullscreen blur scale). */
export function gradientToCSS(g: Gradient): string {
  const layersCSS = g.layers
    .map((l, i) => {
      const blurLine = l.blur > 0 ? `\nfilter: blur(90px); /* use 130px on desktop */` : ''
      return `/* Layer ${i + 1} - ${l.blendMode} */\nbackground: ${l.background};\nmix-blend-mode: ${l.blendMode};${blurLine}`
    })
    .join('\n\n')

  return `/* ${g.name} - ${g.category}) */\n/* Base - set on body/page for blend modes */\nbackground-color: ${g.base};\n\n${layersCSS}${g.grain ? '\n\n/* Grain: apply SVG feTurbulence noise overlay */' : ''}`
}

/* ── Theme-aware blend modes ── */

/**
 * Catalog blend modes are authored against their natural backdrop (mostly
 * dark). Over a light theme background, `hard-light`, `soft-light`, `screen`
 * and `overlay` wash the gradient out to white. Map them to `multiply` so the
 * original hues render as tints on a light base - "white base, same colors".
 */
export function resolveBlendMode(mode: string, light: boolean): string {
  if (!light) return mode
  switch (mode) {
    case 'hard-light':
    case 'soft-light':
    case 'screen':
    case 'overlay':
      return 'multiply'
    default:
      return mode
  }
}

/* ── Fullscreen blur scaling ── */

/**
 * Catalog blur values are tuned for card thumbnails (raw px). Fullscreen
 * backgrounds need much more blur for the atmospheric effect. Scale linearly
 * from the thumbnail anchor (36px → 90/130px on mobile/desktop) so edited
 * values produce a visible difference in the preview.
 */
export function scaleBlurFull(blur: number): { mobile: number; desktop: number } {
  if (blur <= 0) return { mobile: 0, desktop: 0 }
  return {
    mobile: Math.min(200, Math.round(blur * 2.5)),
    desktop: Math.min(260, Math.round(blur * 3.6)),
  }
}

/* ── Featured gradients ──
   Shown first in the grid (no visual label), pinned by id in this order. */
export const FEATURED_IDS: string[] = [
  'sunrise-drift',
  'golden-hour',
  'midnight-sapphire',
  'grain-dusty-rose',
  'aurora-borealis',
  'aurora-beams',
  'champagne-fizz',
  'silver-mist',
  'arctic-frost',
  'ember-glow',
  'phantom-arc',
  'vercel-edge-glow',
  'blood-aurora',
]
