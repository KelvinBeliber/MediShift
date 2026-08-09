import { currentShift, type ShiftKey } from '@/lib/shifts'
import { cn } from '@/lib/utils'

/**
 * The full-bleed backdrop behind every auth screen: the MediShift brand
 * poster, on ground that carries the current shift.
 *
 * Two decisions worth keeping:
 *
 * 1. **The poster runs edge-to-edge.** The artwork is a 16:9 frame, same as
 *    almost every desktop monitor, so `object-cover` fills the viewport with
 *    little to no crop on the common case — `object-contain` was tried here
 *    first and was the wrong call: on a 16:9 viewport it scales the (also
 *    16:9) artwork to fill the box completely, leaving no gap for the card at
 *    all, so the card just sits on top of the artwork's right side instead of
 *    in the clear space the artwork was composed with. Left-anchored so the
 *    logo, headline, and clinicians — all composed into the left two-thirds
 *    of the frame — survive the crop on narrower-than-16:9 viewports.
 * 2. **The backdrop is stateful.** A brand image alone is the same pixels at
 *    03:00 and 11:00, which makes it wallpaper rather than half the thesis. A
 *    wash carries the current shift's colour up from the foot of the frame,
 *    so the backdrop reads as ward-state rather than static art.
 */

const WASH: Record<ShiftKey, string> = {
  morning: 'from-shift-morning/25',
  afternoon: 'from-shift-afternoon/25',
  night: 'from-shift-night/25',
}

export function AuthBackground() {
  const shift = currentShift()

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-brand-navy">
      <picture className="absolute inset-0 block">
        {/* No AVIF source: Pillow's AVIF encoder writes colour-space
            metadata Chromium's decoder reads wrong, so the same file that
            decodes correctly everywhere else renders with badly shifted
            colours in Chrome (near-black rendering as near-white — verified
            by decoding the identical bytes with Pillow and in-browser and
            diffing pixel samples). WebP losslessly matches the source
            exactly and is supported everywhere this app targets. */}
        <source
          srcSet="/brand/login-illustration.webp 1672w, /brand/login-illustration-640.webp 900w"
          sizes="100vw"
          type="image/webp"
        />
        <img
          src="/brand/login-illustration.png"
          width={1672}
          height={941}
          fetchPriority="high"
          alt="MediShift — Smarter Schedules. Better Care. AI-powered workforce management for healthcare teams."
          className="size-full object-cover object-left"
        />
      </picture>

      {/* The ward's current shift, washed up from the foot of the frame. */}
      <div
        className={cn('absolute inset-0 bg-gradient-to-t to-transparent', WASH[shift.key])}
      />

      {/* Darkens the right third slightly so the white card always has a
          consistent, legible surface to sit on regardless of what the
          artwork behind it looks like at that width. */}
      <div className="absolute inset-y-0 right-0 w-full bg-gradient-to-l from-brand-navy/35 via-transparent to-transparent lg:w-2/3" />
    </div>
  )
}
