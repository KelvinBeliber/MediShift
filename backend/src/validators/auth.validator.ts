import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  // Deliberately optional at the API layer — PRODUCT.md > Users documents
  // self-registration without a linked Employee as an accepted (if degraded)
  // outcome, not an error. Do not make this required without revisiting that.
  employeeId: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
});

// The client normally sends no body at all and relies on the httpOnly
// refresh cookie — `.default({})` keeps that request valid instead of
// failing schema validation on an undefined body.
export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .default({});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
