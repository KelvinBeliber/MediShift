import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { ApiError } from '@utils/ApiError';
import * as authService from '@services/auth/auth.service';
import { env } from '@config/env';

const REFRESH_COOKIE_NAME = 'refreshToken';

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    // Cross-domain deploys (e.g. Vercel frontend + Render backend) need
    // SameSite=None to carry the cookie at all — browsers require Secure
    // whenever SameSite=None is set, so the two are tied together here.
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
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
  sendSuccess(res, 200, 'Login successful', { accessToken, refreshToken, user });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.body.refreshToken ?? req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    throw ApiError.unauthorized('Refresh token missing');
  }
  const { accessToken, refreshToken } = await authService.refreshTokens(token, requestMeta(req));
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, 200, 'Token refreshed', { accessToken, refreshToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.body.refreshToken ?? req.cookies?.[REFRESH_COOKIE_NAME];
  if (req.user) {
    await authService.logout(req.user.id, token);
  }
  clearRefreshCookie(res);
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
