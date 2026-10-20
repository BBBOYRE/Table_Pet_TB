import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

// A small original tray icon, generated without downloading artwork.
const size = 32
const pixels = Buffer.alloc(size * (size * 4 + 1))
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const inside = (x - 16) ** 2 + (y - 17) ** 2 < 12 ** 2
  const eye = ((x - 12) ** 2 + (y - 17) ** 2 < 2.5) || ((x - 20) ** 2 + (y - 17) ** 2 < 2.5)
  const leaf = ((x - 19) ** 2 / 25 + (y - 5) ** 2 / 9) < 1
  const color = eye ? [31, 69, 63, 255] : leaf ? [54, 128, 107, 255] : inside ? [154, 217, 186, 255] : [0, 0, 0, 0]
  pixels.set(color, y * (size * 4 + 1) + 1 + x * 4)
}
function crc(bytes) {
  let c = 0xffffffff
  for (const byte of bytes) { c ^= byte; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0) }
  return (c ^ 0xffffffff) >>> 0
}
function chunk(name, data) {
  const body = Buffer.concat([Buffer.from(name), data])
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc(body))
  return Buffer.concat([length, body, checksum])
}
const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6
mkdirSync('resources', { recursive: true })
writeFileSync('resources/tray.png', Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]))
