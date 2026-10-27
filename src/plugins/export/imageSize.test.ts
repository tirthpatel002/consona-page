import { describe, expect, it } from 'vitest'
import { imageSize } from './imageSize'

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

describe('imageSize', () => {
  it('reads PNG and GIF headers and rejects junk', () => {
    const png = b64(
      'iVBORw0KGgoAAAANSUhEUgAAAZAAAADICAIAAABJdyC1AAAACXBIWXMAAAABAAAAAQBPJcTWAAAAB0lEQVR4nGP6DwABBQEAyjpupAAAAABJRU5ErkJggg==',
    )
    expect(imageSize(png)).toEqual({ width: 400, height: 200 })
    const gif = b64('R0lGODlhAwACAIAAAP///wAAACwAAAAAAwACAAACAoRRADs=')
    expect(imageSize(gif)).toEqual({ width: 3, height: 2 })
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull()
  })
})
