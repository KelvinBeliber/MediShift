import { Link, type LinkProps } from 'react-router'
import { cn } from '@/lib/utils'

/**
 * An inline link in the auth flow. Uses `brand-teal-deep` via `--primary`
 * (5.1:1 on white) rather than the brand teal, which is an identity colour and
 * fails contrast at this size. See the Two-Teal Rule in DESIGN.md.
 */
export function AuthLink({ className, ...props }: LinkProps) {
  return (
    <Link
      className={cn(
        // `text-sm` is pinned rather than inherited: this link sits both inside
        // `text-sm` footers and beside a 14px field label in normal-size prose,
        // and inheriting made the same component render 14px in one place and
        // 16px in the other. One size, per DESIGN.md > Typography > Label.
        'rounded-sm text-sm font-medium text-primary underline-offset-4 transition-colors hover:text-brand-teal-press hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  )
}
