import { Router } from 'express';
import * as shiftSwapController from '@controllers/shiftSwap/shiftSwap.controller';
import { authenticate } from '@middleware/authenticate';
import { authorize, authorizeAny } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { PERMISSIONS } from '@constants/permissions';
import {
  createShiftSwapSchema,
  rejectSwapSchema,
  shiftSwapIdParamSchema,
  shiftSwapQuerySchema,
} from '@validators/shiftSwap.validator';

const router = Router();

router.use(authenticate);

router.get('/', validateRequest({ query: shiftSwapQuerySchema }), shiftSwapController.getSwapRequests);

router.get('/:id', validateRequest({ params: shiftSwapIdParamSchema }), shiftSwapController.getSwapRequest);

router.post(
  '/',
  authorizeAny(PERMISSIONS.SHIFT_SWAP_REQUEST, PERMISSIONS.SHIFT_SWAP_APPROVE),
  validateRequest({ body: createShiftSwapSchema }),
  shiftSwapController.createSwapRequest
);

router.post(
  '/:id/accept',
  authorizeAny(PERMISSIONS.SHIFT_SWAP_REQUEST, PERMISSIONS.SHIFT_SWAP_APPROVE),
  validateRequest({ params: shiftSwapIdParamSchema }),
  shiftSwapController.acceptSwapRequest
);

router.post(
  '/:id/approve',
  authorize(PERMISSIONS.SHIFT_SWAP_APPROVE),
  validateRequest({ params: shiftSwapIdParamSchema }),
  shiftSwapController.approveSwapRequest
);

router.post(
  '/:id/reject',
  authorize(PERMISSIONS.SHIFT_SWAP_APPROVE),
  validateRequest({ params: shiftSwapIdParamSchema, body: rejectSwapSchema }),
  shiftSwapController.rejectSwapRequest
);

router.post(
  '/:id/cancel',
  validateRequest({ params: shiftSwapIdParamSchema }),
  shiftSwapController.cancelSwapRequest
);

export default router;
