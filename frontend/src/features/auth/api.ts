import { get, post } from '@/lib/api/client'
import type {
  AuthUser,
  LoginCredentials,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
} from './types'

export const authApi = {
  login: (credentials: LoginCredentials) => post<LoginResponse>('/auth/login', credentials),

  register: (payload: RegisterPayload) => post<RegisterResponse>('/auth/register', payload),

  logout: () => post<null>('/auth/logout'),

  me: () => get<AuthUser>('/auth/me'),

  forgotPassword: (email: string) => post<null>('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    post<null>('/auth/reset-password', { token, newPassword }),

  verifyEmail: (token: string) => post<null>('/auth/verify-email', { token }),

  resendVerification: (email: string) => post<null>('/auth/resend-verification', { email }),

  changePassword: (currentPassword: string, newPassword: string) =>
    post<null>('/auth/change-password', { currentPassword, newPassword }),
}
