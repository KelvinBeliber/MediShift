import { Router } from 'express';
import * as notificationController from '@controllers/notification/notification.controller';
import { authenticate } from '@middleware/authenticate';
import { validateRequest } from '@middleware/validateRequest';
import { notificationIdParamSchema, notificationQuerySchema } from '@validators/notification.validator';

const router = Router();

router.use(authenticate);

router.get('/', validateRequest({ query: notificationQuerySchema }), notificationController.getNotifications);
router.put('/read-all', notificationController.markAllAsRead);
router.put('/:id/read', validateRequest({ params: notificationIdParamSchema }), notificationController.markAsRead);

export default router;
