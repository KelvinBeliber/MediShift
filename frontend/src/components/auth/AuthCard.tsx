import type { ReactNode } from 'react'
import { ShiftBand } from '@/components/ShiftBand'

interface AuthCardProps {
  title: string
  description?: ReactNode
  children: ReactNode
  /** Rendered under the form, separated by a rule — usually the cross-link. */
  footer?: ReactNode
  /**
   * The shift band answers "what time is it on the ward", which is context a
   * person signing in wants and a person reading a one-off result screen does
   * not. Off for terminal states.
   */
  showShiftBand?: boolean
}

/**
 * The right-hand content stack, identical across all five screens: state, then
 * title, then explanation, then the task, then the way out.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
  showShiftBand = true,
}: AuthCardProps) {
  return (
    <div>
      {showShiftBand && <ShiftBand className="mb-5" />}

      <h1 className="text-[1.875rem] leading-[1.15] font-semibold tracking-[-0.021em] text-balance">
        {title}
      </h1>

      {description && (
        <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      )}

      <div className="mt-8">{children}</div>

      {footer && (
        <div className="mt-8 border-t border-border pt-5 text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  )
}
