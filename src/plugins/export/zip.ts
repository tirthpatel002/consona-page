/** Minimal ZIP writer: stored (uncompressed) entries, enough for .docx packages. */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  readonly name: string
  readonly data: Uint8Array
}

/** Packages entries into a single ZIP archive (no compression, no directories). */
export function createZip(entries: readonly ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  const u16 = (value: number) => new Uint8Array([value & 0xff, (value >>> 8) & 0xff])
  const u32 = (value: number) =>
    new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff])

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const local = [
      u32(0x04034b50),
      u16(20), // version needed
      u16(0), // flags
      u16(0), // method: stored
      u16(0),
      u16(0x21), // fixed DOS date: 1980-01-01
      u32(crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0), // extra length
      name,
    ]
    for (const chunk of local) chunks.push(chunk)
    chunks.push(entry.data)
    central.push(
      u32(0x02014b50),
      u16(20), // version made by
      u16(20), // version needed
      u16(0),
      u16(0),
      u16(0),
      u16(0x21),
      u32(crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    )
    offset += local.reduce((sum, chunk) => sum + chunk.length, 0) + entry.data.length
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0)
  const end = [
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralSize),
    u32(offset),
    u16(0),
  ]
  const total = offset + centralSize + end.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let cursor = 0
  for (const chunk of [...chunks, ...central, ...end]) {
    out.set(chunk, cursor)
    cursor += chunk.length
  }
  return out
}

/** Reads back entry names and data from an archive written by createZip (test helper). */
export function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries = new Map<string, Uint8Array>()
  let offset = 0
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true)
    const size = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength))
    const dataStart = offset + 30 + nameLength + extraLength
    if (method !== 0) throw new Error(`unsupported compression for ${name}`)
    entries.set(name, bytes.slice(dataStart, dataStart + size))
    offset = dataStart + size
  }
  return entries
}
