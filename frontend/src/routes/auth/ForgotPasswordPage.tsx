import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { EnvelopeOpenIcon } from '@heroicons/react/24/outline'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthLink } from '@/components/auth/AuthLink'
import { FormAlert } from '@/components/auth/FormAlert'
import { SubmitButton } from '@/components/auth/SubmitButton'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { authApi } from '@/features/auth/api'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/features/auth/schemas'
import { authErrorMessage } from '@/features/auth/authError'
import { applyFieldErrors } from '@/lib/api/errors'

/** Screen 3 — `/forgot-password`. */
export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const request = useMutation({ mutationFn: authApi.forgotPassword })

  const onSubmit = async ({ email }: ForgotPasswordValues) => {
    setFormError(null)
    try {
      await request.mutateAsync(email)
      setSent(true)
    } catch (error) {
      if (applyFieldErrors(error, form.setError)) return
      setFormError(authErrorMessage(error))
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <AuthCard
          title="Check your email"
          showShiftBand={false}
          // Deliberately does not confirm whether the address exists. The API
          // refuses to reveal that; repeating it back as "we sent it to you"
          // would undo that server-side decision on the client.
          description="If an account with that email exists, a password reset link has been sent. The link is valid for one hour."
          footer={<AuthLink to="/login">Back to sign in</AuthLink>}
        >
          <div className="space-y-5">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/8 text-primary">
              <EnvelopeOpenIcon className="size-5" aria-hidden="true" />
            </div>

            <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
              Nothing arrived? Check your spam folder, then confirm with HR which address is on your
              employee record.
            </p>

            {import.meta.env.DEV && (
              <FormAlert tone="info">
                <strong className="font-semibold">Development note:</strong> no SMTP server is
                configured, so nothing was actually sent. The reset link is printed in the terminal
                running <code className="font-mono text-[0.8125rem]">npm run dev</code> in{' '}
                <code className="font-mono text-[0.8125rem]">backend/</code>.
              </FormAlert>
            )}
          </div>
        </AuthCard>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <AuthCard
        title="Reset your password"
        description="Enter your work email and we'll send a link to set a new password. The link is valid for one hour."
        footer={
          <>
            Remembered it? <AuthLink to="/login">Back to sign in</AuthLink>
          </>
        }
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {formError && <FormAlert>{formError}</FormAlert>}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      autoFocus
                      placeholder="you@hospital.org"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SubmitButton pending={request.isPending} pendingLabel="Sending link…">
              Send reset link
            </SubmitButton>
          </form>
        </Form>
      </AuthCard>
    </AuthLayout>
  )
}
