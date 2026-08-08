import { Router } from 'express';
import * as reportController from '@controllers/report/report.controller';
import { authenticate } from '@middleware/authenticate';
import { authorizeAny } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { PERMISSIONS } from '@constants/permissions';
import { reportRangeQuerySchema, dashboardQuerySchema } from '@validators/report.validator';

const router = Router();

router.use(authenticate);
const canView = authorizeAny(PERMISSIONS.REPORT_VIEW, PERMISSIONS.ANALYTICS_VIEW);

router.get('/dashboard', canView, validateRequest({ query: dashboardQuerySchema }), reportController.getDashboard);
router.get('/attendance-trends', canView, validateRequest({ query: reportRangeQuerySchema }), reportController.getAttendanceTrends);
router.get('/leave-statistics', canView, validateRequest({ query: reportRangeQuerySchema }), reportController.getLeaveStatistics);
router.get('/overtime-trends', canView, validateRequest({ query: reportRangeQuerySchema }), reportController.getOvertimeTrends);
router.get('/shift-coverage', canView, validateRequest({ query: reportRangeQuerySchema }), reportController.getShiftCoverage);
router.get(
  '/department-utilization',
  canView,
  validateRequest({ query: reportRangeQuerySchema }),
  reportController.getDepartmentUtilization
);

export default router;
