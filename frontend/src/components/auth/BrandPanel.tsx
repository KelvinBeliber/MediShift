import { LG_QUERY, useMediaQuery } from '@/hooks/useMediaQuery'
import { currentShift, type ShiftKey } from '@/lib/shifts'
import { cn } from '@/lib/utils'

/**
 * The left half of the auth shell: the MediShift brand poster, on ground that
 * carries the current shift.
 *
 * Three decisions worth keeping:
 *
 * 1. **Nothing is cropped.** The poster is 1:1 square, but a half-screen
 *    panel runs ~0.80 at 1440x900 and ~0.89 at 1920x1080, so `object-cover`
 *    would throw away up to a quarter of it — and there is no safe crop, with
 *    the logo at the top edge and the three clinicians at the bottom. The sharp
 *    image is `object-contain`, and a scaled, blurred copy of the same file
 *    mattes it. Because the matting is literally the poster's own colours there
 *    is no seam at any aspect ratio, and one decode serves both.
 * 2. **The panel is stateful.** A brand image alone is the same pixels at 03:00
 *    and 11:00, which makes the left half an image slot rather than half the
 *    thesis. A wash and a rail at the seam carry the current shift's colour, so
 *    the split reads as ward-state on the left and task on the right.
 * 3. **Below `lg` this renders nothing at all.** A `hidden` utility is
 *    `display: none`, and browsers still download `<img>` sources inside a
 *    `display: none` subtree — verified in this project, a 375px viewport was
 *    fetching the poster. Phones must not pay for artwork they never see.
 */

const WASH: Record<ShiftKey, string> = {
  morning: 'from-shift-morning/25',
  afternoon: 'from-shift-afternoon/25',
  night: 'from-shift-night/25',
}

const RAIL: Record<ShiftKey, string> = {
  morning: 'bg-shift-morning',
  afternoon: 'bg-shift-afternoon',
  night: 'bg-shift-night',
}

export function BrandPanel() {
  const isDesktop = useMediaQuery(LG_QUERY)
  if (!isDesktop) return null

  const shift = currentShift()

  return (
    <div className="relative overflow-hidden bg-brand-mist">
      <img
        src="/brand/login-illustration-640.webp"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 size-full scale-125 object-cover opacity-70 blur-2xl"
      />

      {/* The ward's current shift, washed up from the foot of the panel. */}
      <div
        aria-hidden="true"
        className={cn('absolute inset-0 bg-gradient-to-t to-transparent', WASH[shift.key])}
      />

      {/* Absolutely positioned so the poster's 2:3 intrinsic ratio never drives
          the grid row's height — otherwise a 900px-tall viewport would grow to
          ~1070px and the whole page would scroll just to fit the artwork. */}
      <picture className="absolute inset-0 block">
        <source
          srcSet="/brand/login-illustration.avif 1024w, /brand/login-illustration-640.avif 640w"
          sizes="50vw"
          type="image/avif"
        />
        <source
          srcSet="/brand/login-illustration.webp 1024w, /brand/login-illustration-640.webp 640w"
          sizes="50vw"
          type="image/webp"
        />
        <img
          src="/brand/login-illustration.png"
          width={1024}
          height={1024}
          fetchPriority="high"
          alt="MediShift — Smarter Schedules. Better Care. AI-powered workforce management for healthcare teams."
          className="size-full object-contain"
        />
      </picture>

      {/* The seam. Reads as the edge of the ward rather than the edge of an
          image, and is the one place the two halves touch. */}
      <div
        aria-hidden="true"
        className={cn('absolute inset-y-0 right-0 w-[3px]', RAIL[shift.key])}
      />
    </div>
  )
}
