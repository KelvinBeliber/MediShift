import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { CheckCircleIcon, LinkIcon } from '@heroicons/react/24/outline'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthLink } from '@/components/auth/AuthLink'
import { FormAlert } from '@/components/auth/FormAlert'
import { PasswordField } from '@/components/auth/PasswordField'
import { SubmitButton } from '@/components/auth/SubmitButton'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { authApi } from '@/features/auth/api'
import {
  PASSWORD_MIN,
  resetPasswordSchema,
  type ResetPasswordValues,
} from '@/features/auth/schemas'
import { useAuthStore } from '@/features/auth/store'
import { authErrorMessage } from '@/features/auth/authError'
import { applyFieldErrors } from '@/lib/api/errors'

const REDIRECT_DELAY_MS = 4000

/** Screen 4 — `/reset-password?token=…`, the target of the emailed link. */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const clearSession = useAuthStore((s) => s.clear)

  const token = searchParams.get('token')
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const reset = useMutation({
    mutationFn: (password: string) => authApi.resetPassword(token ?? '', password),
  })

  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => void navigate('/login', { replace: true }), REDIRECT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [done, navigate])

  const onSubmit = async ({ password }: ResetPasswordValues) => {
    setFormError(null)
    try {
      await reset.mutateAsync(password)
      // The API revokes every refresh token on reset, so any session this
      // browser still held is already dead server-side. Drop it locally too.
      clearSession()
      setDone(true)
    } catch (error) {
      if (applyFieldErrors(error, form.setError)) return
      setFormError(authErrorMessage(error))
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <AuthCard
          title="This link is incomplete"
          showShiftBand={false}
          description="The reset link is missing its token, which usually means it was cut short by an email client. Request a fresh one and open it directly."
          footer={<AuthLink to="/login">Back to sign in</AuthLink>}
        >
          <div className="space-y-5">
            <div className="flex size-11 items-center justify-center rounded-full bg-destructive/8 text-destructive">
              <LinkIcon className="size-5" aria-hidden="true" />
            </div>
            <AuthLink to="/forgot-password" className="inline-block">
              Request a new reset link
            </AuthLink>
          </div>
        </AuthCard>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout>
        <AuthCard
          title="Password updated"
          showShiftBand={false}
          description="You've been signed out everywhere else. Sign in with your new password."
          footer={<AuthLink to="/login">Continue to sign in</AuthLink>}
        >
          <div className="space-y-5">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/8 text-primary">
              <CheckCircleIcon className="size-5" aria-hidden="true" />
            </div>
            <p className="text-[0.9375rem] text-muted-foreground" role="status">
              Taking you to sign in…
            </p>
          </div>
        </AuthCard>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <AuthCard
        title="Choose a new password"
        description="Setting a new password signs you out of every device."
        footer={<AuthLink to="/login">Back to sign in</AuthLink>}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {formError && (
              <FormAlert>
                <p>{formError}</p>
                <AuthLink to="/forgot-password" className="mt-1 inline-block">
                  Request a new link
                </AuthLink>
              </FormAlert>
            )}

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <PasswordField {...field} autoComplete="new-password" autoFocus />
                  </FormControl>
                  <FormDescription>At least {PASSWORD_MIN} characters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <PasswordField {...field} autoComplete="new-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SubmitButton pending={reset.isPending} pendingLabel="Updating password…">
              Set new password
            </SubmitButton>
          </form>
        </Form>
      </AuthCard>
    </AuthLayout>
  )
}
