import { useMemo } from 'react'
import { motion } from 'motion/react'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * A one-time particle burst for a genuinely rare, high-emotion moment — the
 * employee dashboard's streak card crossing into a new tier.
 *
 * This is the one deliberate exception to "surfaces arrive, content doesn't"
 * in `lib/motion.ts`: that rule protects figures a user is waiting to read,
 * and this never gates one — it layers over a number that already rendered.
 * Per the animation audit's category 8 (missed opportunities), a rare
 * celebration is exactly the place the system's usual restraint is allowed to
 * spend some delight. It never loops and never repeats for the same
 * milestone — see `useStreakCelebration` in `EmployeeSections.tsx`.
 *
 * Particles reuse the system's own palette (achievement amber, brand green,
 * brand teal) rather than arbitrary confetti colours, so the celebration
 * still reads as *this* product's, not a generic effect dropped in.
 */

const PARTICLE_COLORS = [
  'var(--color-achievement-amber)',
  'var(--color-brand-green)',
  'var(--color-brand-teal)',
]

interface Particle {
  angle: number
  distance: number
  size: number
  color: string
  delay: number
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
    distance: 40 + Math.random() * 30,
    size: 3 + Math.random() * 3,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length]!,
    delay: Math.random() * 0.06,
  }))
}

export function ConfettiBurst({ className }: { className?: string }) {
  // Generated once per mount — this component is only ever mounted for the
  // duration of the burst itself, never kept around to re-render.
  const particles = useMemo(() => makeParticles(16), [])

  return (
    <span
      className={cn('pointer-events-none absolute inset-0 overflow-visible', className)}
      aria-hidden="true"
    >
      {particles.map((particle, i) => (
        <motion.span
          key={i}
          className="absolute top-1/2 left-1/2 rounded-full"
          style={{ width: particle.size, height: particle.size, backgroundColor: particle.color }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
          animate={{
            x: Math.cos(particle.angle) * particle.distance,
            y: Math.sin(particle.angle) * particle.distance,
            opacity: 0,
            scale: 1,
          }}
          transition={{ duration: 0.7, delay: particle.delay, ease: EASE_OUT }}
        />
      ))}
    </span>
  )
}
