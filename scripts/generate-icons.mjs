/**
 * Regenerates the app icons from one SVG: the "Ez" monogram on the glass
 * tile (V2 Phase 5). A placeholder until the real Ezlyfts logo exists; when it
 * does, replace monogramSvg() and re-run:
 *
 *   node scripts/generate-icons.mjs
 *
 * Writes, at the sizes and shapes the manifest and <head> already reference:
 *   public/icon-{192,512}.png            rounded tile on transparent ("any")
 *   public/icon-{192,512}-maskable.png   full-bleed square, art inside the
 *                                         80% safe zone ("maskable")
 *   public/apple-touch-icon.png          180, full-bleed (iOS rounds it)
 *   src/app/favicon.ico                  16, 32, 48, 256 (PNG-in-ICO)
 *
 * After changing any of these, bump CACHE in public/sw.js: the files keep
 * their names, so the old art would otherwise be served from cache.
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BRAND_TEXT = 'Ez'

/**
 * @param {{ fullBleed: boolean }} opts
 *   fullBleed: paint the background to every edge (maskable / iOS), and keep
 *   the tile inside the central safe zone; otherwise a rounded outer tile on
 *   transparency, as the previous icons were.
 */
function monogramSvg({ fullBleed }) {
  const outer = fullBleed
    ? '<rect width="512" height="512" fill="url(#bg)"/>'
    : '<rect x="8" y="8" width="496" height="496" rx="112" fill="url(#bg)"/>'
  // The inner glass tile; smaller when it must fit a maskable safe zone.
  const tile = fullBleed
    ? { x: 76, y: 76, s: 360, r: 72 }
    : { x: 52, y: 52, s: 408, r: 84 }
  const cx = 256
  const textY = tile.y + tile.s * 0.62
  const fontSize = tile.s * 0.46
  const barW = tile.s * 0.37
  const barY = tile.y + tile.s * 0.82

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="0%" r="95%">
      <stop offset="0" stop-color="#4b1a21"/>
      <stop offset="0.55" stop-color="#1d1a1f"/>
      <stop offset="1" stop-color="#13161b"/>
    </radialGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a2a30"/>
      <stop offset="0.5" stop-color="#22232a"/>
      <stop offset="1" stop-color="#1b1e24"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.06"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e5484d"/>
      <stop offset="0.5" stop-color="#f26a6e"/>
      <stop offset="1" stop-color="#e5484d"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="9"/>
      <feFlood flood-color="#e5484d" flood-opacity="0.55"/>
      <feComposite operator="in" in2="SourceAlpha"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>
  ${outer}
  <g filter="url(#shadow)">
    <rect x="${tile.x}" y="${tile.y}" width="${tile.s}" height="${tile.s}" rx="${tile.r}" fill="url(#glass)"/>
  </g>
  <rect x="${tile.x + 1.5}" y="${tile.y + 1.5}" width="${tile.s - 3}" height="${tile.s - 3}" rx="${tile.r - 1.5}" fill="none" stroke="url(#rim)" stroke-width="3"/>
  <text x="${cx}" y="${textY}" text-anchor="middle" filter="url(#glow)"
    font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900"
    font-size="${fontSize}" letter-spacing="-4" fill="#f5f8fe">${BRAND_TEXT}</text>
  <rect x="${cx - barW / 2}" y="${barY}" width="${barW}" height="${tile.s * 0.045}" rx="${tile.s * 0.0225}" fill="url(#bar)" filter="url(#glow)"/>
</svg>`
}

async function png(svg, size, file, { flatten = false } = {}) {
  let img = sharp(Buffer.from(svg)).resize(size, size)
  if (flatten) img = img.flatten({ background: '#13161b' })
  const out = await img.png().toBuffer()
  if (file) writeFileSync(path.join(root, file), out)
  return out
}

/** A PNG-in-ICO container: one directory entry per size, PNG payloads. */
function ico(pngs) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  const entries = []
  let offset = 6 + 16 * pngs.length
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2)
    e.writeUInt8(0, 3)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    entries.push(e)
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)])
}

const anySvg = monogramSvg({ fullBleed: false })
const bleedSvg = monogramSvg({ fullBleed: true })

await png(anySvg, 192, 'public/icon-192.png')
await png(anySvg, 512, 'public/icon-512.png')
await png(bleedSvg, 192, 'public/icon-192-maskable.png', { flatten: true })
await png(bleedSvg, 512, 'public/icon-512-maskable.png', { flatten: true })
await png(bleedSvg, 180, 'public/apple-touch-icon.png', { flatten: true })

const icoSizes = [16, 32, 48, 256]
const icoPngs = []
for (const size of icoSizes) {
  icoPngs.push({ size, data: await png(anySvg, size) })
}
writeFileSync(path.join(root, 'src/app/favicon.ico'), ico(icoPngs))

console.log('Icons written.')
