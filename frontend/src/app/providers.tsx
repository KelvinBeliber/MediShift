import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { queryClient } from '@/lib/query'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    // `ui/sonner` calls next-themes' useTheme(), so the provider has to be
    // mounted for toasts to theme correctly. MediShift is light-only for now:
    // the `.dark` block in index.css still carries the unbranded shadcn
    // neutrals and needs a deliberate pass before it can be reached.
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false}>
      {/* `reducedMotion="user"` is set once here rather than per-component: it
          strips transforms and leaves opacity on every `motion` element in the
          app, so no screen has to remember to honour the preference itself. */}
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster richColors position="top-right" />
        </QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  )
}
