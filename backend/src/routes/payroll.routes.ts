import { Router } from 'express';
import * as payrollController from '@controllers/payroll/payroll.controller';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { PERMISSIONS } from '@constants/permissions';
import {
  generatePayrollSchema,
  payrollIdParamSchema,
  payrollQuerySchema,
  payrollExportQuerySchema,
} from '@validators/payroll.validator';

const router = Router();

router.use(authenticate);

router.post(
  '/generate',
  authorize(PERMISSIONS.PAYROLL_MANAGE),
  validateRequest({ body: generatePayrollSchema }),
  payrollController.generatePayroll
);

router.get(
  '/export',
  authorize(PERMISSIONS.PAYROLL_VIEW),
  validateRequest({ query: payrollExportQuerySchema }),
  payrollController.exportPayrollCsv
);

router.get('/', authorize(PERMISSIONS.PAYROLL_VIEW), validateRequest({ query: payrollQuerySchema }), payrollController.getPayrollInputs);

router.get(
  '/:id',
  authorize(PERMISSIONS.PAYROLL_VIEW),
  validateRequest({ params: payrollIdParamSchema }),
  payrollController.getPayrollInput
);

router.put(
  '/:id/finalize',
  authorize(PERMISSIONS.PAYROLL_MANAGE),
  validateRequest({ params: payrollIdParamSchema }),
  payrollController.finalizePayrollInput
);

export default router;
