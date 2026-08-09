import { Router } from 'express';
import * as messageController from '@controllers/message/message.controller';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { PERMISSIONS } from '@constants/permissions';
import {
  sendMessageSchema,
  messageIdParamSchema,
  userIdParamSchema,
  departmentIdParamSchema,
  messageQuerySchema,
} from '@validators/message.validator';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(PERMISSIONS.MESSAGE_SEND),
  validateRequest({ body: sendMessageSchema }),
  messageController.sendMessage
);

router.get('/conversations', messageController.getDirectInbox);

router.get(
  '/direct/:userId',
  validateRequest({ params: userIdParamSchema, query: messageQuerySchema }),
  messageController.getDirectConversation
);

router.get(
  '/department/:departmentId',
  validateRequest({ params: departmentIdParamSchema, query: messageQuerySchema }),
  messageController.getDepartmentConversation
);

router.put(
  '/:id/read',
  validateRequest({ params: messageIdParamSchema }),
  messageController.markMessageRead
);

export default router;
