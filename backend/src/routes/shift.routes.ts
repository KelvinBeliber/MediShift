import { Router } from 'express';
import * as shiftController from '@controllers/schedule/shift.controller';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { PERMISSIONS } from '@constants/permissions';
import { createShiftSchema, updateShiftSchema, shiftIdParamSchema, shiftQuerySchema } from '@validators/shift.validator';
import {
  assignEmployeeSchema,
  updateAssignmentStatusSchema,
  assignmentIdParamSchema,
} from '@validators/shiftAssignment.validator';

const router = Router();

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.SCHEDULE_VIEW), validateRequest({ query: shiftQuerySchema }), shiftController.getShifts);

router.get(
  '/:id',
  authorize(PERMISSIONS.SCHEDULE_VIEW),
  validateRequest({ params: shiftIdParamSchema }),
  shiftController.getShift
);

router.post(
  '/',
  authorize(PERMISSIONS.SCHEDULE_EDIT),
  validateRequest({ body: createShiftSchema }),
  shiftController.createShift
);

router.put(
  '/:id',
  authorize(PERMISSIONS.SCHEDULE_EDIT),
  validateRequest({ params: shiftIdParamSchema, body: updateShiftSchema }),
  shiftController.updateShift
);

router.delete(
  '/:id',
  authorize(PERMISSIONS.SCHEDULE_EDIT),
  validateRequest({ params: shiftIdParamSchema }),
  shiftController.deleteShift
);

router.post(
  '/:id/assignments',
  authorize(PERMISSIONS.SCHEDULE_EDIT),
  validateRequest({ params: shiftIdParamSchema, body: assignEmployeeSchema }),
  shiftController.assignEmployee
);

router.put(
  '/:id/assignments/:assignmentId',
  authorize(PERMISSIONS.SCHEDULE_EDIT),
  validateRequest({ params: shiftIdParamSchema.merge(assignmentIdParamSchema), body: updateAssignmentStatusSchema }),
  shiftController.updateAssignmentStatus
);

router.delete(
  '/:id/assignments/:assignmentId',
  authorize(PERMISSIONS.SCHEDULE_EDIT),
  validateRequest({ params: shiftIdParamSchema.merge(assignmentIdParamSchema) }),
  shiftController.removeAssignment
);

export default router;
