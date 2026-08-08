import { z } from 'zod'

/**
 * Client-side mirrors of the backend validators in
 * `backend/src/validators/auth.validator.ts`.
 *
 * Two rules matter and are easy to get wrong:
 *
 * - The only password rule the API enforces is **8 characters minimum**. There
 *   is no complexity regex, no maximum, and no `confirmPassword` field. Adding a
 *   "must contain a number" rule here would reject passwords the API accepts.
 * - `confirm` fields exist on the client only; they are stripped before the
 *   request is sent.
 */

const PASSWORD_MIN = 8

const email = z
  .string()
  .trim()
  .min(1, 'Enter your work email.')
  .pipe(z.email('Enter a valid email address.'))
  .transform((value) => value.toLowerCase())

const newPassword = z
  .string()
  .min(1, 'Choose a password.')
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
})

export const forgotPasswordSchema = z.object({ email })

export const registerSchema = z
  .object({
    // Required in the UI by product decision, though the API treats it as
    // optional: registering without it creates an account with no linked
    // Employee record, so no schedule, no profile, and a 400 from
    // GET /employees/me. See PRODUCT.md > Users.
    employeeId: z
      .string()
      .trim()
      .min(1, 'Enter the employee ID from your onboarding email.')
      .transform((value) => value.toUpperCase()),
    firstName: z.string().trim().min(1, 'Enter your first name.'),
    lastName: z.string().trim().min(1, 'Enter your last name.'),
    email,
    password: newPassword,
    confirmPassword: z.string().min(1, 'Re-enter your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Both passwords must match.',
    path: ['confirmPassword'],
  })

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string().min(1, 'Re-enter your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Both passwords must match.',
    path: ['confirmPassword'],
  })

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

export { PASSWORD_MIN }
