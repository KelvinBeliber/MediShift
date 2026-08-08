import { Router } from 'express';
import * as documentController from '@controllers/document/document.controller';
import { authenticate } from '@middleware/authenticate';
import { validateRequest } from '@middleware/validateRequest';
import { documentIdParamSchema } from '@validators/document.validator';

const router = Router();

router.use(authenticate);

// Self-or-employee:edit is enforced inside the controller (it must load the
// document first to discover its owner before it can check "is this me?").
router.delete('/:id', validateRequest({ params: documentIdParamSchema }), documentController.deleteDocument);

export default router;
