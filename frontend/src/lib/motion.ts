import type { Transition, Variants } from 'motion/react'

/**
 * The motion vocabulary for the whole product.
 *
 * Every screen imports its timings from here rather than typing durations
 * inline, so "how long does a card take to arrive" is one decision made once
 * instead of twenty-five made separately. Screen 6 (Dashboard) is where these
 * were set; screens 7+ extend this file rather than competing with it.
 *
 * ## Why there is any entrance motion at all
 *
 * DESIGN.md's original rule was "Don't animate anything on page load. This is
 * product UI; users arrive already in a task." That rule stands for *content* —
 * text does not fade in, tables do not cascade, nothing the user came to read
 * is ever withheld behind a timeline.
 *
 * The narrow amendment: a **surface** may arrive. On a dashboard the cards land
 * as data resolves, and without a transition the swap from skeleton to figure is
 * a hard cut that reads as a flicker. So panels get one short, shallow rise —
 * 220ms, 8px, 40ms apart, once — and then the page is still. The stagger is
 * capped at `STAGGER_MAX_INDEX` so a long list never turns into a wave.
 *
 * The test for anything added here: if a user waiting on a number has to wait
 * longer because of it, it is decoration and does not belong.
 */

/** Seconds. Named for the job, not the number, so the numbers can be tuned centrally. */
export const DURATION = {
  /** Hover, press, colour and border changes. Matches DESIGN.md's 150ms button hover. */
  instant: 0.15,
  /** A surface arriving: card mount, skeleton → content swap. */
  enter: 0.22,
  /** A surface leaving. Exits run shorter than entrances — nobody waits to watch. */
  exit: 0.15,
  /** Layout reflow when a role-gated section appears or collapses. */
  layout: 0.28,
} as const

/**
 * Expo-out. Fast off the mark, long settle — a surface that has already mostly
 * arrived by the time the eye reaches it. Used for every entrance.
 */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const

/** Symmetric in-out, for reflow where both ends of the move are watched. */
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const

/** Seconds between siblings in a staggered mount. */
export const STAGGER = 0.04

/**
 * Past this many siblings the stagger flattens. Twelve cards at 40ms is already
 * half a second of arrival; a twentieth card must not wait 800ms to exist.
 */
export const STAGGER_MAX_INDEX = 6

export const enterTransition: Transition = {
  duration: DURATION.enter,
  ease: EASE_OUT,
}

export const layoutTransition: Transition = {
  duration: DURATION.layout,
  ease: EASE_IN_OUT,
}

/**
 * Put on a grid or section wrapper; children use `panelVariants`.
 * `delayChildren` stays 0 — the first card should not wait on the container.
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: STAGGER, delayChildren: 0 },
  },
}

/** The one entrance in the system: 8px up, over 220ms. */
export const panelVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: enterTransition },
  exit: { opacity: 0, y: 4, transition: { duration: DURATION.exit, ease: EASE_OUT } },
}

/**
 * Manual stagger for cases where a `staggerChildren` container is impractical —
 * siblings split across permission-gated fragments, for instance, where the
 * container cannot see how many children will actually render.
 */
export function panelDelay(index: number): number {
  return Math.min(index, STAGGER_MAX_INDEX) * STAGGER
}

/**
 * Reduced motion is handled by `<MotionConfig reducedMotion="user">` in
 * `app/providers.tsx`, which zeroes transforms and opacity transitions
 * globally. This helper is for the non-Motion cases — a CSS transition or a
 * counter component that needs to be told directly.
 */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
