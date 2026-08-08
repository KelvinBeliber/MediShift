/**
 * Derives every shipped brand asset in `public/brand/` from the sources in
 * `assets/brand/`. Run with `npm run brand` after replacing a source file.
 *
 * Two things here are not just format conversion:
 *
 * 1. `logo.png` has no alpha channel — it is artwork on an opaque white
 *    rectangle. `unmatteWhite` recovers an alpha channel from it so the mark can
 *    sit on tinted surfaces. This is a recovery, not a substitute for a proper
 *    transparent export; see the note in DESIGN.md.
 * 2. The poster is emitted at two widths so a 1280px-wide laptop does not
 *    download the 1920px asset.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'assets', 'brand')
const OUT = join(root, 'public', 'brand')

const AVIF = { quality: 62, effort: 6 }
const WEBP = { quality: 82, effort: 6 }

/**
 * Recovers an alpha channel from artwork composited onto opaque white.
 *
 * For a pixel that was `src` over white at coverage `a`, each channel is
 * `c = s*a + 255*(1-a)`. The most-covered channel is the darkest one, so
 * `a = 1 - min(r,g,b)/255` recovers coverage, and dividing the white term back
 * out un-mattes the colour. Fully white pixels fall out at a = 0.
 */
async function unmatteWhite(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const alpha = 255 - Math.min(r, g, b)

    if (alpha === 0) {
      data[i + 3] = 0
      continue
    }

    const white = 255 - alpha
    data[i] = Math.max(0, Math.min(255, Math.round(((r - white) * 255) / alpha)))
    data[i + 1] = Math.max(0, Math.min(255, Math.round(((g - white) * 255) / alpha)))
    data[i + 2] = Math.max(0, Math.min(255, Math.round(((b - white) * 255) / alpha)))
    data[i + 3] = alpha
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer()
}

/** Emits AVIF + WebP + PNG for one source at one width. */
async function emit(input, name, width) {
  const base = sharp(input).resize({ width, withoutEnlargement: true })
  const [avif, webp, png] = await Promise.all([
    base.clone().avif(AVIF).toBuffer(),
    base.clone().webp(WEBP).toBuffer(),
    base.clone().png({ compressionLevel: 9, palette: true }).toBuffer(),
  ])

  await Promise.all([
    writeFile(join(OUT, `${name}.avif`), avif),
    writeFile(join(OUT, `${name}.webp`), webp),
    writeFile(join(OUT, `${name}.png`), png),
  ])

  const kb = (buf) => `${(buf.length / 1024).toFixed(0)}kB`
  console.log(`  ${name.padEnd(26)} ${width}w   avif ${kb(avif)}  webp ${kb(webp)}  png ${kb(png)}`)
}

await mkdir(OUT, { recursive: true })
console.log('brand assets ->', OUT)

// The login poster. Rendered `object-contain` in a half-screen panel, so the
// tallest realistic need is ~1080px of panel height => ~720px of image width.
// 1024 covers that at 1x and 640 covers a 1280px laptop.
await emit(join(SRC, 'login-illustration.png'), 'login-illustration', 1024)
await emit(join(SRC, 'login-illustration.png'), 'login-illustration-640', 640)

// The wordmark already carries a real alpha channel.
await emit(join(SRC, 'wordmark.png'), 'wordmark', 640)

// The logo source does not, so recover one first. Note the source is the full
// stacked lockup (ring mark over wordmark over tagline), which is only used as
// an intermediate here — the shipped assets are the mark cropped out of it.
const lockupAlpha = await unmatteWhite(join(SRC, 'logo.png'))

// The ring mark alone, cropped out of the 1254px lockup. The full lockup is
// unreadable below ~120px, so anything favicon-sized has to use just the mark.
const markAlpha = await sharp(lockupAlpha)
  .extract({ left: 300, top: 130, width: 654, height: 654 })
  .png()
  .toBuffer()

// Only what the app actually references. Emitting a 512px lockup and a 256px
// mark that nothing imports is ~470kB of dead weight in the repo.
await emit(markAlpha, 'mark-96', 96)

// Favicons use the mark. Apple's touch icon must be opaque, so it keeps a
// white ground and a little breathing room inside the tile.
await sharp(markAlpha)
  .resize(156, 156)
  .extend({ top: 12, bottom: 12, left: 12, right: 12, background: '#ffffff' })
  .flatten({ background: '#ffffff' })
  .png()
  .toFile(join(OUT, 'apple-touch-icon.png'))

for (const size of [32, 180]) {
  await sharp(markAlpha)
    .resize(size, size)
    .png()
    .toFile(join(root, 'public', `favicon-${size}.png`))
}

console.log('  favicons                   32 / 180 / apple-touch-icon (mark only)')
console.log('done.')
