import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { ApiError } from '@utils/ApiError';
import * as authService from '@services/auth/auth.service';
import { env } from '@config/env';

const REFRESH_COOKIE_NAME = 'refreshToken';

/**
 * Attributes shared by set and clear.
 *
 * A deletion is just a Set-Cookie with an expiry in the past, and the browser
 * only applies it if the attributes line up with the cookie it is replacing. In
 * particular a cross-site deploy sets `SameSite=None; Secure`, and a clearing
 * response that omits those is treated as a default-Lax cookie and rejected
 * outright in a cross-site XHR — which would leave a fully valid refresh cookie
 * in the browser after sign-out. Keep the two call sites sharing one object so
 * they cannot drift apart.
 */
const refreshCookieOptions = {
  httpOnly: true,
  // Cross-domain deploys (e.g. Vercel frontend + Render backend) need
  // SameSite=None to carry the cookie at all — browsers require Secure
  // whenever SameSite=None is set, so the two are tied together here.
  secure: env.isProduction,
  sameSite: (env.isProduction ? 'none' : 'lax') as 'none' | 'lax',
  path: '/api/v1/auth',
} as const;

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...refreshCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
}

/**
 * Express 5 leaves `req.body` undefined when a request carries no body at all —
 * which is exactly what the browser sends for sign-out, since the credential is
 * the cookie. Reading it unguarded threw, turning every real sign-out into a
 * 500 that revoked nothing.
 */
function readRefreshToken(req: Request): string | undefined {
  const fromBody = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
  if (typeof fromBody === 'string' && fromBody.length > 0) return fromBody;
  const fromCookie = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof fromCookie === 'string' && fromCookie.length > 0 ? fromCookie : undefined;
}

function requestMeta(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  sendSuccess(res, 201, 'Registration successful. Please check your email to verify your account.', result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { accessToken, refreshToken, user } = await authService.login(email, password, requestMeta(req));
  setRefreshCookie(res, refreshToken);
  // The refresh token is intentionally absent from the body: it lives only in
  // the httpOnly cookie, so script on the page (and therefore any XSS) can
  // never read the long-lived credential.
  sendSuccess(res, 200, 'Login successful', { accessToken, user });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = readRefreshToken(req);
  if (!token) {
    throw ApiError.unauthorized('Refresh token missing');
  }
  const { accessToken, refreshToken } = await authService.refreshTokens(token, requestMeta(req));
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, 200, 'Token refreshed', { accessToken });
});

/**
 * Sign out. Unauthenticated on purpose — the refresh cookie is the credential,
 * and requiring a live access token meant an expired session could never be
 * revoked. Always clears the cookie and always answers 200, so the client can
 * treat sign-out as unconditional and nothing here doubles as an oracle.
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  clearRefreshCookie(res);
  await authService.logout(readRefreshToken(req), req.user?.id);
  sendSuccess(res, 200, 'Logged out successfully');
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email);
  sendSuccess(res, 200, 'If an account with that email exists, a password reset link has been sent.');
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.newPassword);
  sendSuccess(res, 200, 'Password has been reset. Please log in with your new password.');
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  await authService.verifyEmail(req.body.token);
  sendSuccess(res, 200, 'Email verified successfully');
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  await authService.resendVerification(req.body.email);
  sendSuccess(res, 200, 'If an account with that email exists and is unverified, a new verification link has been sent.');
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }
  await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  clearRefreshCookie(res);
  sendSuccess(res, 200, 'Password changed. Please log in again.');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }
  const user = await authService.getMe(req.user.id);
  sendSuccess(res, 200, 'Current user retrieved', user);
});
