import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

/**
 * Catches any unmatched path. Previously the router redirected `*` straight to
 * /dashboard, so a typo'd URL silently became a dashboard visit with no signal
 * anything was wrong.
 */
export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Button asChild className="mt-2">
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  )
}
