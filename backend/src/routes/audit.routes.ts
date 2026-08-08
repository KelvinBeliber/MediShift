import { Router } from 'express';
import * as auditController from '@controllers/audit/audit.controller';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { PERMISSIONS } from '@constants/permissions';
import { auditLogIdParamSchema, auditLogQuerySchema } from '@validators/audit.validator';

const router = Router();

router.use(authenticate);
router.use(authorize(PERMISSIONS.AUDIT_LOG_VIEW));

router.get('/', validateRequest({ query: auditLogQuerySchema }), auditController.getAuditLogs);
router.get('/:id', validateRequest({ params: auditLogIdParamSchema }), auditController.getAuditLog);

export default router;
