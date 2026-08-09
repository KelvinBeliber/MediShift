import { Router } from 'express';
import * as attendanceController from '@controllers/attendance/attendance.controller';
import { authenticate } from '@middleware/authenticate';
import { authorize, authorizeAny } from '@middleware/authorize';
import { validateRequest } from '@middleware/validateRequest';
import { PERMISSIONS } from '@constants/permissions';
import {
  clockEventSchema,
  breakEventSchema,
  attendanceIdParamSchema,
  attendanceQuerySchema,
  attendanceSummaryQuerySchema,
  attendanceMineQuerySchema,
} from '@validators/attendance.validator';

const router = Router();

router.use(authenticate);

const selfOrManage = authorizeAny(PERMISSIONS.ATTENDANCE_RECORD_OWN, PERMISSIONS.ATTENDANCE_MANAGE);

router.post('/clock-in', selfOrManage, validateRequest({ body: clockEventSchema }), attendanceController.clockIn);
router.post('/clock-out', selfOrManage, validateRequest({ body: clockEventSchema }), attendanceController.clockOut);
router.post('/break-start', selfOrManage, validateRequest({ body: breakEventSchema }), attendanceController.breakStart);
router.post('/break-end', selfOrManage, validateRequest({ body: breakEventSchema }), attendanceController.breakEnd);

router.get('/today', selfOrManage, attendanceController.getToday);

/**
 * The caller's own attendance history — always scoped to `req.user.employeeId`,
 * never to a query param. Unlike `/`  and `/summary` below, this needs no
 * `attendance:view`: it mirrors `GET /leave`'s self-scope pattern (an account
 * can always read its own records), so `employee` and `shift_coordinator` —
 * neither of whom hold `attendance:view` — can build real streak/hours-worked
 * figures for themselves without a broader grant. Must be registered before
 * `/:id` or `/mine` would be parsed as an object-id param and 400.
 */
router.get('/mine', validateRequest({ query: attendanceMineQuerySchema }), attendanceController.getMyAttendance);

router.get(
  '/summary',
  authorize(PERMISSIONS.ATTENDANCE_VIEW),
  validateRequest({ query: attendanceSummaryQuerySchema }),
  attendanceController.getSummary
);

router.get(
  '/',
  authorize(PERMISSIONS.ATTENDANCE_VIEW),
  validateRequest({ query: attendanceQuerySchema }),
  attendanceController.getAttendanceList
);

router.get(
  '/:id',
  authorize(PERMISSIONS.ATTENDANCE_VIEW),
  validateRequest({ params: attendanceIdParamSchema }),
  attendanceController.getAttendanceRecord
);

router.post('/mark-absentees', authorize(PERMISSIONS.ATTENDANCE_MANAGE), attendanceController.markAbsentees);

export default router;
