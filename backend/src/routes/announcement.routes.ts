import { Router } from 'express';
import * as announcementController from '@controllers/announcement/announcement.controller';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { PERMISSIONS } from '@constants/permissions';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  announcementIdParamSchema,
  announcementQuerySchema,
} from '@validators/announcement.validator';

const router = Router();

router.use(authenticate);

router.get('/', validateRequest({ query: announcementQuerySchema }), announcementController.getAnnouncements);

router.get('/:id', validateRequest({ params: announcementIdParamSchema }), announcementController.getAnnouncement);

router.post(
  '/',
  authorize(PERMISSIONS.ANNOUNCEMENT_MANAGE),
  validateRequest({ body: createAnnouncementSchema }),
  announcementController.createAnnouncement
);

router.put(
  '/:id',
  authorize(PERMISSIONS.ANNOUNCEMENT_MANAGE),
  validateRequest({ params: announcementIdParamSchema, body: updateAnnouncementSchema }),
  announcementController.updateAnnouncement
);

router.delete(
  '/:id',
  authorize(PERMISSIONS.ANNOUNCEMENT_MANAGE),
  validateRequest({ params: announcementIdParamSchema }),
  announcementController.deactivateAnnouncement
);

export default router;
