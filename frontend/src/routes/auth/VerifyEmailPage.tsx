import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CheckCircleIcon, LinkIcon } from '@heroicons/react/24/solid'
import Loader from '@/components/kokonutui/loader'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthLink } from '@/components/auth/AuthLink'
import { authApi } from '@/features/auth/api'
import { useAuthStore } from '@/features/auth/store'
import { toApiError } from '@/lib/api/errors'

type Status = 'pending' | 'success' | 'failed'

/** Screen 5 — `/verify-email?token=…`, the target of the emailed link. */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<Status>(() => (token ? 'pending' : 'failed'))
  const [message, setMessage] = useState<string | null>(
    token ? null : 'This verification link is missing its token.',
  )

  // Verification tokens are single-use. StrictMode mounts effects twice in
  // development, and the second POST would come back 400 — flashing a failure
  // on a verification that actually succeeded. A ref survives the double-invoke
  // because it is the same fiber, so the request fires exactly once.
  const fired = useRef(false)

  useEffect(() => {
    if (!token || fired.current) return
    fired.current = true

    // Note there is deliberately no "is this effect still mounted" flag here.
    // The ref above already guarantees one request, so on StrictMode's second
    // mount this effect returns before it could re-arm such a flag — leaving
    // the in-flight promise holding a stale `false` and silently dropping the
    // result. Setting state after unmount is a harmless no-op in React 18+.
    authApi
      .verifyEmail(token)
      .then(() => {
        setStatus('success')

        // Keep an already-signed-in session honest so nothing downstream keeps
        // nagging them to verify.
        const { user, setUser } = useAuthStore.getState()
        if (user && !user.isEmailVerified) setUser({ ...user, isEmailVerified: true })
      })
      .catch((error: unknown) => {
        setStatus('failed')
        setMessage(toApiError(error).message)
      })
  }, [token])

  if (status === 'pending') {
    return (
      <AuthLayout>
        <AuthCard title="Verifying your email" showShiftBand={false}>
          <Loader
            size="sm"
            subtitle="Checking your link — this only takes a moment."
            className="items-start text-left"
          />
        </AuthCard>
      </AuthLayout>
    )
  }

  if (status === 'success') {
    return (
      <AuthLayout>
        <AuthCard
          title="Email verified"
          showShiftBand={false}
          description="Thanks — the address on your MediShift account is confirmed."
          footer={<AuthLink to="/login">Continue to sign in</AuthLink>}
        >
          <div className="flex size-11 items-center justify-center text-primary">
            <CheckCircleIcon className="size-8" aria-hidden="true" />
          </div>
        </AuthCard>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <AuthCard
        title="We couldn't verify this link"
        showShiftBand={false}
        description={message ?? 'This verification link is no longer valid.'}
        footer={<AuthLink to="/login">Continue to sign in</AuthLink>}
      >
        <div className="space-y-5">
          <div className="flex size-11 items-center justify-center text-destructive">
            <LinkIcon className="size-8" aria-hidden="true" />
          </div>

          {/* There is no resend-verification endpoint — `buildVerificationEmail`
              is called in exactly one place, inside register(). So there is no
              resend button here, and equally no "ask your administrator", which
              would be a dead instruction rather than a dead control. State the
              wall plainly and then say why it doesn't matter. */}
          <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
            Verification links last 24 hours and work only once, and they can't currently be
            reissued.
          </p>
          <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
            This doesn't block you. Verifying only confirms the address on your account — you can
            sign in either way.
          </p>
        </div>
      </AuthCard>
    </AuthLayout>
  )
}
