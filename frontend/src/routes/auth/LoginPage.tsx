import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation, useNavigate } from 'react-router'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthLink } from '@/components/auth/AuthLink'
import { FormAlert } from '@/components/auth/FormAlert'
import { PasswordField } from '@/components/auth/PasswordField'
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
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { useLogin } from '@/features/auth/useLogin'
import { authErrorMessage } from '@/features/auth/authError'
import { applyFieldErrors } from '@/lib/api/errors'

/** Screen 1 — `/login`. */
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // Set by RequireAuth when it bounces a deep link, so signing in returns the
  // user to where they were actually headed.
  const from = (location.state as { from?: string } | null)?.from

  const onSubmit = async (values: LoginValues) => {
    setFormError(null)
    try {
      await login.mutateAsync(values)
      await navigate(from ?? '/dashboard', { replace: true })
    } catch (error) {
      if (applyFieldErrors(error, form.setError)) return

      setFormError(authErrorMessage(error))
      form.resetField('password')
    }
  }

  return (
    <AuthLayout>
      <AuthCard
        title="Sign in"
        description="Your schedule, your shifts, and your time clock."
        footer={
          <>
            New here? <AuthLink to="/register">Claim your account</AuthLink>
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

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-baseline justify-between gap-3">
                    <FormLabel>Password</FormLabel>
                    <AuthLink to="/forgot-password">Forgot password?</AuthLink>
                  </div>
                  <FormControl>
                    <PasswordField {...field} autoComplete="current-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SubmitButton pending={login.isPending} pendingLabel="Signing in…">
              Sign in
            </SubmitButton>
          </form>
        </Form>
      </AuthCard>
    </AuthLayout>
  )
}
