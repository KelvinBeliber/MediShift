import { Router } from 'express';
import * as leaveController from '@controllers/leave/leave.controller';
import { authenticate } from '@middleware/authenticate';
import { authorize, authorizeAny } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { PERMISSIONS } from '@constants/permissions';
import {
  createLeaveRequestSchema,
  approvalSchema,
  rejectionSchema,
  leaveIdParamSchema,
  leaveQuerySchema,
} from '@validators/leave.validator';

const router = Router();

router.use(authenticate);

router.get('/', validateRequest({ query: leaveQuerySchema }), leaveController.getLeaveRequests);

router.get('/:id', validateRequest({ params: leaveIdParamSchema }), leaveController.getLeaveRequest);

router.post(
  '/',
  authorizeAny(PERMISSIONS.LEAVE_REQUEST, PERMISSIONS.LEAVE_APPROVE),
  validateRequest({ body: createLeaveRequestSchema }),
  leaveController.createLeaveRequest
);

router.post(
  '/:id/cancel',
  validateRequest({ params: leaveIdParamSchema }),
  leaveController.cancelLeaveRequest
);

router.post(
  '/:id/department-approve',
  authorize(PERMISSIONS.LEAVE_APPROVE),
  validateRequest({ params: leaveIdParamSchema, body: approvalSchema }),
  leaveController.departmentApprove
);

router.post(
  '/:id/hr-approve',
  authorize(PERMISSIONS.LEAVE_APPROVE),
  validateRequest({ params: leaveIdParamSchema, body: approvalSchema }),
  leaveController.hrApprove
);

router.post(
  '/:id/reject',
  authorize(PERMISSIONS.LEAVE_APPROVE),
  validateRequest({ params: leaveIdParamSchema, body: rejectionSchema }),
  leaveController.rejectLeaveRequest
);

export default router;
