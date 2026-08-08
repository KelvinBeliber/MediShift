import { Router } from 'express';
import * as certificationController from '@controllers/certification/certification.controller';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { PERMISSIONS } from '@constants/permissions';
import {
  createCertificationSchema,
  updateCertificationSchema,
  certificationIdParamSchema,
} from '@validators/certification.validator';

const router = Router();

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.CERTIFICATION_VIEW), certificationController.getCertifications);

router.get(
  '/:id',
  authorize(PERMISSIONS.CERTIFICATION_VIEW),
  validateRequest({ params: certificationIdParamSchema }),
  certificationController.getCertification
);

router.post(
  '/',
  authorize(PERMISSIONS.CERTIFICATION_MANAGE),
  validateRequest({ body: createCertificationSchema }),
  certificationController.createCertification
);

router.put(
  '/:id',
  authorize(PERMISSIONS.CERTIFICATION_MANAGE),
  validateRequest({ params: certificationIdParamSchema, body: updateCertificationSchema }),
  certificationController.updateCertification
);

router.delete(
  '/:id',
  authorize(PERMISSIONS.CERTIFICATION_MANAGE),
  validateRequest({ params: certificationIdParamSchema }),
  certificationController.deactivateCertification
);

export default router;
