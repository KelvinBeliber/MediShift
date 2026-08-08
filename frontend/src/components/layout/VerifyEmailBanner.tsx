import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { authApi } from '@/features/auth/api'
import { authErrorMessage } from '@/features/auth/authError'

/**
 * `isEmailVerified` comes back on every `GET /auth/me` but was previously
 * fetched and stored with nothing ever reading it — unverified users logged in
 * fully with no prompt. Shown app-wide (not just on Verify Email) since login
 * itself never blocks on verification.
 */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [sent, setSent] = useState(false)

  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(email),
    onSuccess: () => {
      setSent(true)
      toast.success('Verification email sent — check your inbox.')
    },
    onError: (error) => toast.error(authErrorMessage(error)),
  })

  return (
    <div className="flex items-center gap-3 border-b bg-amber-50 px-6 py-2.5 text-sm text-amber-900">
      <ExclamationTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">
        Verify your email address ({email}) to secure your account.
        {import.meta.env.DEV && ' No SMTP is configured in dev — grab the link from the backend terminal.'}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={resend.isPending || sent}
        onClick={() => resend.mutate()}
      >
        {sent ? 'Link sent' : resend.isPending ? 'Sending…' : 'Resend link'}
      </Button>
    </div>
  )
}
