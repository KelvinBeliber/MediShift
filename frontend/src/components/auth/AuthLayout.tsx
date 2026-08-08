import type { ReactNode } from 'react'
import { LG_QUERY, useMediaQuery } from '@/hooks/useMediaQuery'
import { BrandPanel } from './BrandPanel'

/**
 * The shell every auth screen shares: brand poster on the left, task on the
 * right. Above and below `lg` each brand asset is rendered or absent, never
 * merely `hidden` — `display: none` does not stop a browser downloading an
 * `<img>` source, so a utility class alone would have desktop paying for the
 * mobile wordmark and phones paying for the poster.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery(LG_QUERY)

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <BrandPanel />

      <main className="flex flex-col bg-card">
        {!isDesktop && (
          <div className="flex items-center gap-3 border-b border-border bg-brand-mist-50 px-6 py-5">
            <picture>
              <source srcSet="/brand/mark-96.avif" type="image/avif" />
              <source srcSet="/brand/mark-96.webp" type="image/webp" />
              <img src="/brand/mark-96.png" width={96} height={96} alt="" className="size-9" />
            </picture>
            <picture>
              <source srcSet="/brand/wordmark.avif" type="image/avif" />
              <source srcSet="/brand/wordmark.webp" type="image/webp" />
              <img
                src="/brand/wordmark.png"
                width={971}
                height={286}
                alt="MediShift — Smarter Schedules. Better Care."
                className="h-9 w-auto"
              />
            </picture>
          </div>
        )}

        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <footer className="px-6 pb-8 sm:px-10">
          <p className="mx-auto w-full max-w-sm text-[0.6875rem] text-muted-foreground">
            MediShift · Smarter schedules. Better care.
          </p>
        </footer>
      </main>
    </div>
  )
}
