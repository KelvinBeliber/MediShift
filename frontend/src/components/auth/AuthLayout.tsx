import type { ReactNode } from 'react'
import { AuthBackground } from './AuthBackground'

/**
 * The shell every auth screen shares: the brand poster fills the whole
 * viewport, and the task floats on top as a white card. The poster's own
 * artwork (logo, headline, clinicians) already lives in the left two-thirds
 * of the frame, so the card sits in the open right third at `lg` and up, and
 * centered below that.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AuthBackground />

      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10 lg:justify-end lg:pr-16 xl:pr-24">
        <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-2xl shadow-black/30 sm:p-10">
          {children}
        </div>
      </main>

      <footer className="px-6 pb-8 text-center sm:px-10 lg:pr-16 lg:text-right xl:pr-24">
        <p className="mx-auto w-full max-w-sm text-[0.6875rem] text-white/70 lg:mr-0">
          MediShift · Smarter schedules. Better care.
        </p>
      </footer>
    </div>
  )
}
