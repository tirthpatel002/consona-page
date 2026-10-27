/** Pixel size of a PNG, GIF or JPEG from its header bytes, or null when it cannot be read. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const u16be = (i: number) => ((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0)
  const u32be = (i: number) => (u16be(i) * 65536 + u16be(i + 2)) >>> 0
  const u16le = (i: number) => (bytes[i] ?? 0) | ((bytes[i + 1] ?? 0) << 8)
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: u32be(16), height: u32be(20) }
  }
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: u16le(6), height: u16le(8) }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null
      const marker = bytes[i + 1] ?? 0
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: u16be(i + 5), width: u16be(i + 7) }
      }
      i += 2 + u16be(i + 2)
    }
  }
  return null
}
