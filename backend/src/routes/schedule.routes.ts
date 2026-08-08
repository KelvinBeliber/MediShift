import { Router } from 'express';
import * as scheduleController from '@controllers/schedule/schedule.controller';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { PERMISSIONS } from '@constants/permissions';
import {
  createScheduleSchema,
  updateScheduleSchema,
  scheduleIdParamSchema,
  scheduleQuerySchema,
} from '@validators/schedule.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize(PERMISSIONS.SCHEDULE_VIEW),
  validateRequest({ query: scheduleQuerySchema }),
  scheduleController.getSchedules
);

router.get(
  '/:id',
  authorize(PERMISSIONS.SCHEDULE_VIEW),
  validateRequest({ params: scheduleIdParamSchema }),
  scheduleController.getSchedule
);

router.post(
  '/',
  authorize(PERMISSIONS.SCHEDULE_CREATE),
  validateRequest({ body: createScheduleSchema }),
  scheduleController.createSchedule
);

router.put(
  '/:id',
  authorize(PERMISSIONS.SCHEDULE_EDIT),
  validateRequest({ params: scheduleIdParamSchema, body: updateScheduleSchema }),
  scheduleController.updateSchedule
);

router.delete(
  '/:id',
  authorize(PERMISSIONS.SCHEDULE_DELETE),
  validateRequest({ params: scheduleIdParamSchema }),
  scheduleController.deleteSchedule
);

router.post(
  '/:id/publish',
  authorize(PERMISSIONS.SCHEDULE_PUBLISH),
  validateRequest({ params: scheduleIdParamSchema }),
  scheduleController.publishSchedule
);

router.post(
  '/:id/generate',
  authorize(PERMISSIONS.SCHEDULE_GENERATE),
  validateRequest({ params: scheduleIdParamSchema }),
  scheduleController.generateSchedule
);

router.post(
  '/:id/shifts/preview',
  authorize(PERMISSIONS.SCHEDULE_GENERATE),
  validateRequest({ params: scheduleIdParamSchema }),
  scheduleController.previewShiftGeneration
);

router.post(
  '/:id/shifts/generate',
  authorize(PERMISSIONS.SCHEDULE_GENERATE),
  validateRequest({ params: scheduleIdParamSchema }),
  scheduleController.generateShifts
);

export default router;
