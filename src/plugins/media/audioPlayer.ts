const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m)}:${String(s).padStart(2, '0')}`
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const

const seekInput = () => [
  'input',
  {
    type: 'range',
    class: 'page-media__seek',
    min: '0',
    max: '0',
    value: '0',
    step: '0.1',
    'aria-label': 'Seek',
  },
]

const speedMenu = (moreClass: string, panelClass: string) => [
  'div',
  { class: 'page-media__player-menu' },
  [
    'button',
    {
      type: 'button',
      class: moreClass,
      'aria-label': 'Playback options',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
    },
  ],
  [
    'div',
    { class: panelClass, role: 'menu', hidden: 'true' },
    ['button', { type: 'button', role: 'menuitem', 'data-action': 'download' }, 'Download'],
    ['button', { type: 'button', role: 'menuitem', 'data-action': 'speed', 'data-rate': '0.75' }, '0.75×'],
    ['button', { type: 'button', role: 'menuitem', 'data-action': 'speed', 'data-rate': '1' }, '1×'],
    ['button', { type: 'button', role: 'menuitem', 'data-action': 'speed', 'data-rate': '1.25' }, '1.25×'],
    ['button', { type: 'button', role: 'menuitem', 'data-action': 'speed', 'data-rate': '1.5' }, '1.5×'],
    ['button', { type: 'button', role: 'menuitem', 'data-action': 'speed', 'data-rate': '2' }, '2×'],
  ],
]

function wireShell(
  shell: HTMLElement,
  media: HTMLMediaElement,
  play: HTMLButtonElement,
  time: HTMLElement,
  seek: HTMLInputElement,
  more: HTMLButtonElement,
  panel: HTMLElement,
): void {
  if (shell.dataset.wired === '1') return
  shell.dataset.wired = '1'

  const syncTime = () => {
    const duration = Number.isFinite(media.duration) ? media.duration : 0
    time.textContent = `${formatTime(media.currentTime)} / ${formatTime(duration)}`
    if (!seek.matches(':active')) {
      seek.max = String(duration || 0)
      seek.value = String(media.currentTime || 0)
    }
    play.setAttribute('aria-label', media.paused ? 'Play' : 'Pause')
    if (media.paused) delete play.dataset.playing
    else play.dataset.playing = ''
  }

  play.addEventListener('click', () => {
    if (media.paused) void media.play().catch(() => undefined)
    else media.pause()
  })
  seek.addEventListener('input', () => {
    media.currentTime = Number(seek.value)
    syncTime()
  })
  media.addEventListener('timeupdate', syncTime)
  media.addEventListener('loadedmetadata', syncTime)
  media.addEventListener('play', syncTime)
  media.addEventListener('pause', syncTime)
  media.addEventListener('ended', syncTime)

  const closeMenu = () => {
    panel.hidden = true
    more.setAttribute('aria-expanded', 'false')
  }
  let onOutside: ((event: PointerEvent) => void) | null = null
  more.addEventListener('click', () => {
    const open = panel.hidden
    panel.hidden = !open
    more.setAttribute('aria-expanded', open ? 'true' : 'false')
    if (onOutside) {
      document.removeEventListener('pointerdown', onOutside, true)
      onOutside = null
    }
    if (open) {
      onOutside = (event) => {
        if (event.target instanceof Node && !shell.contains(event.target)) {
          closeMenu()
          if (onOutside) document.removeEventListener('pointerdown', onOutside, true)
          onOutside = null
        }
      }
      document.addEventListener('pointerdown', onOutside, true)
    }
  })
  panel.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action
    if (action === 'download') {
      const href = media.currentSrc || media.getAttribute('src') || ''
      if (!href) return
      const link = document.createElement('a')
      link.href = href
      link.download = ''
      link.rel = 'noopener'
      link.click()
      closeMenu()
    }
    if (action === 'speed') {
      const rate = Number(target.closest<HTMLElement>('[data-rate]')?.dataset.rate)
      if (Number.isFinite(rate)) media.playbackRate = rate
      for (const item of panel.querySelectorAll<HTMLElement>('[data-action="speed"]')) {
        if (Number(item.dataset.rate) === media.playbackRate) item.dataset.active = ''
        else delete item.dataset.active
      }
      closeMenu()
    }
  })

  for (const rate of SPEEDS) {
    const item = panel.querySelector<HTMLElement>(`[data-action="speed"][data-rate="${String(rate)}"]`)
    if (!item) continue
    if (rate === 1) item.dataset.active = ''
    else delete item.dataset.active
  }
  syncTime()
}

/**
 * Wires custom audio/video chrome once per shell. Safe after a frame rebuild;
 * skips wired shells so playback is not interrupted.
 */
export function wireMediaPlayers(root: ParentNode): void {
  for (const shell of root.querySelectorAll<HTMLElement>('.page-media__audio, .page-media__video')) {
    const media = shell.querySelector('audio, video')
    const play = shell.querySelector<HTMLButtonElement>('.page-media__audio-play, .page-media__video-play')
    const time = shell.querySelector<HTMLElement>('.page-media__audio-time, .page-media__video-time')
    const seek = shell.querySelector<HTMLInputElement>('.page-media__seek')
    const more = shell.querySelector<HTMLButtonElement>('.page-media__audio-more, .page-media__video-more')
    const panel = shell.querySelector<HTMLElement>('.page-media__audio-menu-panel, .page-media__video-menu-panel')
    if (!(media instanceof HTMLMediaElement) || !play || !time || !seek || !more || !panel) continue
    wireShell(shell, media, play, time, seek, more, panel)
  }
}

/** @deprecated use wireMediaPlayers */
export const wireAudioPlayer = wireMediaPlayers

/** Custom audio shell: hidden native element + page-styled controls. */
export const audioFrameSpec = (srcAttrs: Record<string, string>): unknown[] => [
  'div',
  { class: 'page-media__audio', contenteditable: 'false' },
  ['audio', { preload: 'metadata', ...srcAttrs }],
  [
    'div',
    { class: 'page-media__audio-ui' },
    ['button', { type: 'button', class: 'page-media__audio-play', 'aria-label': 'Play' }],
    ['span', { class: 'page-media__audio-time' }, '0:00 / 0:00'],
    seekInput(),
    speedMenu('page-media__audio-more', 'page-media__audio-menu-panel'),
  ],
]

/** Custom video shell: no native controls; overlay bar with the same pill seek thumb. */
export const videoFrameSpec = (srcAttrs: Record<string, string>): unknown[] => [
  'div',
  { class: 'page-media__video', contenteditable: 'false' },
  ['video', { preload: 'metadata', playsinline: '', ...srcAttrs }],
  [
    'div',
    { class: 'page-media__video-ui' },
    ['button', { type: 'button', class: 'page-media__video-play', 'aria-label': 'Play' }],
    ['span', { class: 'page-media__video-time' }, '0:00 / 0:00'],
    seekInput(),
    speedMenu('page-media__video-more', 'page-media__video-menu-panel'),
  ],
]
