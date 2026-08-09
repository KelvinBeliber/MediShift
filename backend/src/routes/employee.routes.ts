import { Router } from 'express';
import * as employeeController from '@controllers/employee/employee.controller';
import * as documentController from '@controllers/document/document.controller';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { uploadSingleFile } from '@middleware/upload';
import { PERMISSIONS } from '@constants/permissions';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateOwnProfileSchema,
  employeeIdParamSchema,
  employeeQuerySchema,
} from '@validators/employee.validator';
import { uploadDocumentSchema } from '@validators/document.validator';

const router = Router();

router.use(authenticate);

// Self-service routes — must be registered before "/:id" so Express doesn't
// treat "me" as an :id value. No employee:view/edit permission required: any
// authenticated user may view/edit their own linked profile.
router.get('/me', employeeController.getOwnProfile);
router.put('/me', validateRequest({ body: updateOwnProfileSchema }), employeeController.updateOwnProfile);

// Name/department only, no employee:view required — every authenticated user
// can look up a colleague to start a direct message. See searchDirectory().
router.get('/directory', employeeController.getDirectory);

router.get(
  '/',
  authorize(PERMISSIONS.EMPLOYEE_VIEW),
  validateRequest({ query: employeeQuerySchema }),
  employeeController.getEmployees
);

router.get(
  '/:id',
  authorize(PERMISSIONS.EMPLOYEE_VIEW),
  validateRequest({ params: employeeIdParamSchema }),
  employeeController.getEmployee
);

router.post(
  '/',
  authorize(PERMISSIONS.EMPLOYEE_CREATE),
  validateRequest({ body: createEmployeeSchema }),
  employeeController.createEmployee
);

router.put(
  '/:id',
  authorize(PERMISSIONS.EMPLOYEE_EDIT),
  validateRequest({ params: employeeIdParamSchema, body: updateEmployeeSchema }),
  employeeController.updateEmployee
);

router.delete(
  '/:id',
  authorize(PERMISSIONS.EMPLOYEE_DELETE),
  validateRequest({ params: employeeIdParamSchema }),
  employeeController.deactivateEmployee
);

// Document routes are intentionally not gated by authorize(EMPLOYEE_VIEW/EDIT)
// at the route level — the controller allows self-service (an employee
// managing their own documents) OR employee:view/edit, same pattern as /me.
router.get(
  '/:id/documents',
  validateRequest({ params: employeeIdParamSchema }),
  documentController.getDocuments
);

router.post(
  '/:id/documents',
  validateRequest({ params: employeeIdParamSchema }),
  uploadSingleFile,
  validateRequest({ body: uploadDocumentSchema }),
  documentController.uploadDocument
);

export default router;
