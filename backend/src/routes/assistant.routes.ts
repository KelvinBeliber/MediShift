import { Router, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import * as assistantController from '@controllers/assistant/assistant.controller';
import { authenticate } from '@middleware/authenticate';
import { authorizeAny } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { env } from '@config/env';
import { PERMISSIONS } from '@constants/permissions';
import { ASSISTANT_RATE_LIMIT, ASSISTANT_RATE_WINDOW_MS } from '@constants/assistant';
import { askAssistantSchema } from '@validators/assistant.validator';

const router = Router();

router.use(authenticate);

/**
 * The same gate as Reports — deliberately, not coincidentally. Reusing
 * `report:view` / `analytics:view` means the assistant can never answer a
 * question the caller could not already have answered by reading the Reports
 * screen, and it keeps Employees and Shift Coordinators (who hold neither) out
 * of the feature entirely.
 */
const canAsk = authorizeAny(PERMISSIONS.REPORT_VIEW, PERMISSIONS.ANALYTICS_VIEW);

/**
 * Keyed by **user id, not IP**.
 *
 * This is the one endpoint in MediShift that costs money per call, and a
 * hospital's staff all arrive from behind the same NAT — an IP-keyed limit
 * would either throttle a whole ward because one person was curious, or have to
 * be set so high it stopped being a limit. `authenticate` has already run, so
 * `req.user.id` is available and is the thing actually being rate-limited.
 *
 * Disabled under test for the same reason as the auth limiter: the suite must
 * be able to exercise the endpoint repeatedly.
 */
const assistantLimiter: RequestHandler = env.isTest
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: ASSISTANT_RATE_WINDOW_MS,
      limit: ASSISTANT_RATE_LIMIT,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anonymous',
      message: {
        success: false,
        message: `You've reached the limit of ${ASSISTANT_RATE_LIMIT} assistant questions per hour. Reports and Analytics are still available.`,
      },
    });

router.get('/capabilities', canAsk, assistantController.getCapabilities);
router.post(
  '/ask',
  canAsk,
  assistantLimiter,
  validateRequest({ body: askAssistantSchema }),
  assistantController.ask
);

export default router;
