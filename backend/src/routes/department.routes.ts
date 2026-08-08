import { Router } from 'express';
import * as departmentController from '@controllers/department/department.controller';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { PERMISSIONS } from '@constants/permissions';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  assignManagerSchema,
  assignEmployeesSchema,
  departmentIdParamSchema,
} from '@validators/department.validator';

const router = Router();

router.use(authenticate);

router.get('/', authorize(PERMISSIONS.DEPARTMENT_VIEW), departmentController.getDepartments);

router.get(
  '/:id',
  authorize(PERMISSIONS.DEPARTMENT_VIEW),
  validateRequest({ params: departmentIdParamSchema }),
  departmentController.getDepartment
);

router.get(
  '/:id/stats',
  authorize(PERMISSIONS.DEPARTMENT_VIEW),
  validateRequest({ params: departmentIdParamSchema }),
  departmentController.getDepartmentStats
);

router.post(
  '/',
  authorize(PERMISSIONS.DEPARTMENT_MANAGE),
  validateRequest({ body: createDepartmentSchema }),
  departmentController.createDepartment
);

router.put(
  '/:id',
  authorize(PERMISSIONS.DEPARTMENT_MANAGE),
  validateRequest({ params: departmentIdParamSchema, body: updateDepartmentSchema }),
  departmentController.updateDepartment
);

router.delete(
  '/:id',
  authorize(PERMISSIONS.DEPARTMENT_MANAGE),
  validateRequest({ params: departmentIdParamSchema }),
  departmentController.deactivateDepartment
);

router.post(
  '/:id/manager',
  authorize(PERMISSIONS.DEPARTMENT_MANAGE),
  validateRequest({ params: departmentIdParamSchema, body: assignManagerSchema }),
  departmentController.assignManager
);

router.post(
  '/:id/employees',
  authorize(PERMISSIONS.DEPARTMENT_MANAGE),
  validateRequest({ params: departmentIdParamSchema, body: assignEmployeesSchema }),
  departmentController.assignEmployees
);

export default router;
