import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { EnvelopeOpenIcon } from '@heroicons/react/24/outline'
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
import { Input } from '@/components/ui/input'
import { authApi } from '@/features/auth/api'
import { PASSWORD_MIN, registerSchema, type RegisterValues } from '@/features/auth/schemas'
import type { RegisterPayload, RegisterResponse } from '@/features/auth/types'
import { authErrorMessage } from '@/features/auth/authError'
import { applyFieldErrors, toApiError } from '@/lib/api/errors'

/**
 * The API rejects a bad claim with a specific 400 rather than a 422, so there
 * are no `details[]` to map. Routing each message to the field it is actually
 * about is the difference between "something went wrong" and "that employee ID
 * isn't on file".
 */
function fieldForMessage(message: string): keyof RegisterValues | null {
  const text = message.toLowerCase()
  if (text.includes('employee record found') || text.includes('already linked')) return 'employeeId'
  if (text.includes('email does not match') || text.includes('email already exists')) return 'email'
  return null
}

/** Screen 2 — `/register`. */
export function RegisterPage() {
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      employeeId: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const register = useMutation<RegisterResponse, unknown, RegisterPayload>({
    mutationFn: authApi.register,
  })

  const onSubmit = async (values: RegisterValues) => {
    setFormError(null)
    try {
      const { confirmPassword: _confirmPassword, ...payload } = values
      const created = await register.mutateAsync(payload)
      setRegisteredEmail(created.email)
    } catch (error) {
      if (applyFieldErrors(error, form.setError)) return

      const { status, message } = toApiError(error)

      // A 400 naming the wrong employee ID or a mismatched email belongs on the
      // field it is about, not in a banner above the form.
      const field = status === 400 || status === 409 ? fieldForMessage(message) : null
      if (field) {
        form.setError(field, { message })
        form.setFocus(field)
        return
      }

      setFormError(authErrorMessage(error))
    }
  }

  if (registeredEmail) {
    return (
      <AuthLayout>
        <AuthCard
          title="Check your email"
          showShiftBand={false}
          description={
            <>
              We sent a verification link to{' '}
              <strong className="text-foreground">{registeredEmail}</strong>. It is valid for 24
              hours.
            </>
          }
          footer={
            <>
              Verified already? <AuthLink to="/login">Continue to sign in</AuthLink>
            </>
          }
        >
          <div className="space-y-5">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/8 text-primary">
              <EnvelopeOpenIcon className="size-5" aria-hidden="true" />
            </div>

            <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
              Your account is active — verifying only confirms the address we have on file. You can
              sign in now.
            </p>

            {import.meta.env.DEV && (
              <FormAlert tone="info">
                <strong className="font-semibold">Development note:</strong> no SMTP server is
                configured, so nothing was actually sent. The verification link is printed in the
                terminal running <code className="font-mono text-[0.8125rem]">npm run dev</code> in{' '}
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
        title="Claim your account"
        description="HR creates your employee record first. Enter the ID from your onboarding email to link a login to it."
        footer={
          <>
            Already have a login? <AuthLink to="/login">Sign in</AuthLink>
          </>
        }
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {formError && <FormAlert>{formError}</FormAlert>}

            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="EMP-000123"
                      className="uppercase tabular-nums placeholder:normal-case"
                    />
                  </FormControl>
                  <FormDescription>
                    Your work email must match the one on your employee record exactly.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="given-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="family-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <PasswordField {...field} autoComplete="new-password" />
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
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <PasswordField {...field} autoComplete="new-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SubmitButton pending={register.isPending} pendingLabel="Creating account…">
              Create account
            </SubmitButton>
          </form>
        </Form>
      </AuthCard>
    </AuthLayout>
  )
}
