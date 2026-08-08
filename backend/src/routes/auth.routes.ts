import { Router, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '@controllers/auth/auth.controller';
import { validateRequest } from '@middleware/validateRequest';
import { authenticate } from '@middleware/authenticate';
import { env } from '@config/env';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
  resendVerificationSchema,
} from '@validators/auth.validator';

const router = Router();

// Rate limiting is a production concern — disabled in tests so the suite can
// exercise auth endpoints freely without tripping a 15-minute lockout.
const authLimiter: RequestHandler = env.isTest
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: 'Too many attempts. Please try again later.' },
    });

router.post('/register', authLimiter, validateRequest({ body: registerSchema }), authController.register);
router.post('/login', authLimiter, validateRequest({ body: loginSchema }), authController.login);
router.post('/refresh', validateRequest({ body: refreshSchema }), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.post(
  '/forgot-password',
  authLimiter,
  validateRequest({ body: forgotPasswordSchema }),
  authController.forgotPassword
);
router.post('/reset-password', authLimiter, validateRequest({ body: resetPasswordSchema }), authController.resetPassword);
router.post('/verify-email', validateRequest({ body: verifyEmailSchema }), authController.verifyEmail);
router.post(
  '/resend-verification',
  authLimiter,
  validateRequest({ body: resendVerificationSchema }),
  authController.resendVerification
);
router.get('/me', authenticate, authController.me);
router.post(
  '/change-password',
  authenticate,
  authLimiter,
  validateRequest({ body: changePasswordSchema }),
  authController.changePassword
);

export default router;
