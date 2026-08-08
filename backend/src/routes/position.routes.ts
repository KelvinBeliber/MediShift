import { Router } from 'express';
import * as positionController from '@controllers/position/position.controller';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { PERMISSIONS } from '@constants/permissions';
import { createPositionSchema, updatePositionSchema, positionIdParamSchema } from '@validators/position.validator';

const router = Router();

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.POSITION_VIEW), positionController.getPositions);

router.get(
  '/:id',
  authorize(PERMISSIONS.POSITION_VIEW),
  validateRequest({ params: positionIdParamSchema }),
  positionController.getPosition
);

router.post(
  '/',
  authorize(PERMISSIONS.POSITION_MANAGE),
  validateRequest({ body: createPositionSchema }),
  positionController.createPosition
);

router.put(
  '/:id',
  authorize(PERMISSIONS.POSITION_MANAGE),
  validateRequest({ params: positionIdParamSchema, body: updatePositionSchema }),
  positionController.updatePosition
);

router.delete(
  '/:id',
  authorize(PERMISSIONS.POSITION_MANAGE),
  validateRequest({ params: positionIdParamSchema }),
  positionController.deactivatePosition
);

export default router;
