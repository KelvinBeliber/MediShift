import { Types } from 'mongoose';
import { z } from 'zod';
import { Attendance } from '@models/Attendance.model';
import { Certification } from '@models/Certification.model';
import { Department } from '@models/Department.model';
import { Employee } from '@models/Employee.model';
import { LeaveRequest } from '@models/LeaveRequest.model';
import { Shift } from '@models/Shift.model';
import { ShiftAssignment } from '@models/ShiftAssignment.model';
import * as reportService from '@services/report/report.service';
import { ApiError } from '@utils/ApiError';
import { ASSISTANT_MAX_RANGE_DAYS, ASSISTANT_MAX_ROWS } from '@constants/assistant';
import { AssistantScope, resolveDepartmentFilter } from './scope';

/**
 * The assistant's entire reach over MediShift's data.
 *
 * Three rules hold for every entry in this file, and they are structural rather
 * than advisory:
 *
 * 1. **Read-only.** Every executor is a query. No model in this file is ever
 *    constructed, saved, updated, deleted, or published, and no service function
 *    that does any of those is imported. There is deliberately no write tool to
 *    disable — the capability does not exist to be reached.
 * 2. **Narrow and named.** Each tool answers one question with a fixed shape.
 *    There is no "run this aggregation" or "fetch this collection" escape hatch,
 *    so the set of questions answerable is exactly the set enumerated here.
 * 3. **Scoped before the data is assembled.** Every executor routes its
 *    department argument through `resolveDepartmentFilter`, which pins a
 *    department-scoped caller to their own department regardless of what the
 *    model asked for.
 *
 * Salary is excluded here, at the assembly layer, not by asking the model
 * nicely: no projection in this file selects it (it is `select: false` on the
 * schema besides), and `stripSensitive` scrubs the assembled result on the way
 * out as a second, independent line of defence.
 */

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Field names that must never reach the model, matched on the key rather than
 * the value so a rename to `basePay` or `compensation` is caught too.
 *
 * This is redundant with the projections below and is meant to be. A future
 * tool added by someone who forgets to write an explicit `.select()` fails
 * closed instead of quietly widening what the assistant can see.
 */
const FORBIDDEN_KEYS = /^(salary|salaries|pay|payrate|payRate|basePay|compensation|wage|wages|hourlyRate|grossPay|netPay)$/i;

export function stripSensitive<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripSensitive(entry)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.test(key)) continue;
      out[key] = stripSensitive(entry);
    }
    return out as T;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Shared argument shapes
// ---------------------------------------------------------------------------

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be formatted YYYY-MM-DD')
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((date) => !Number.isNaN(date.getTime()), 'Not a real calendar date');

const departmentArg = z.string().optional().describe('Department id. Omit for all departments.');

const dateRange = z.object({
  dateFrom: isoDate,
  dateTo: isoDate,
});

function assertRange(dateFrom: Date, dateTo: Date): void {
  if (dateTo < dateFrom) {
    throw ApiError.badRequest('dateTo must not be earlier than dateFrom');
  }
  const days = (dateTo.getTime() - dateFrom.getTime()) / (24 * 60 * 60 * 1000);
  if (days > ASSISTANT_MAX_RANGE_DAYS) {
    throw ApiError.badRequest(`Date range is capped at ${ASSISTANT_MAX_RANGE_DAYS} days`);
  }
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Employee fields the assistant is allowed to see. An allowlist rather than an
 * exclusion, so a field added to the schema later is invisible here until
 * someone deliberately adds it.
 */
const EMPLOYEE_FIELDS = 'firstName lastName employeeId department position employmentType status';

/**
 * Attached to a result whenever the model asked about a department the caller
 * cannot see. The answer is still the caller's own department; this is what
 * makes the substitution visible in the transcript rather than silent.
 */
function scopeNote(scope: AssistantScope, coerced: boolean): Record<string, string> {
  if (!coerced) return {};
  return {
    scopeNote: `This user may only see ${scope.departmentName ?? 'their own department'}. The requested department was ignored and these figures are for ${scope.departmentName ?? 'their own department'}. Say so in your answer.`,
  };
}

async function employeeIdsIn(departmentId?: string): Promise<Types.ObjectId[] | undefined> {
  if (!departmentId) return undefined;
  const employees = await Employee.find({ department: departmentId }).select('_id');
  return employees.map((e) => e._id as Types.ObjectId);
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/**
 * A tool the model may call: a JSON-schema-able argument shape, a description
 * the model reads, and an executor that receives the caller's scope.
 */
export interface AssistantTool<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: S;
  execute: (args: z.infer<S>, scope: AssistantScope) => Promise<unknown>;
}

function defineTool<S extends z.ZodType>(tool: AssistantTool<S>): AssistantTool<z.ZodType> {
  return tool as unknown as AssistantTool<z.ZodType>;
}

const listDepartments = defineTool({
  name: 'list_departments',
  description:
    'List the departments this user may ask about, with their ids, codes and active headcount. Call this first when the user names a department in words, to resolve it to an id.',
  schema: z.object({}),
  execute: async (_args, scope) => {
    const filter: Record<string, unknown> = { isActive: true };
    if (scope.mode === 'department') filter._id = scope.departmentId;

    const departments = await Department.find(filter).select('name code description staffingRequirements');

    return Promise.all(
      departments.map(async (department) => ({
        departmentId: department.id,
        name: department.name,
        code: department.code,
        activeHeadcount: await Employee.countDocuments({ department: department._id, status: 'active' }),
        staffingRequirements: department.staffingRequirements.map((requirement) => ({
          shiftType: requirement.shiftType,
          minStaff: requirement.minStaff,
        })),
      }))
    );
  },
});

const getOvertimeSummary = defineTool({
  name: 'get_overtime_summary',
  description:
    'Overtime hours over a date range: the department total, the day-by-day trend, and the employees who worked the most, ranked. Use for "who worked the most overtime" and "is overtime up this month".',
  schema: z
    .object({ department: departmentArg })
    .merge(dateRange)
    .describe('An overtime question about one department (or all) over a date range.'),
  execute: async (args, scope) => {
    assertRange(args.dateFrom, args.dateTo);
    const { departmentId, coerced } = resolveDepartmentFilter(scope, args.department);

    const employeeIds = await employeeIdsIn(departmentId);
    const match: Record<string, unknown> = {
      date: { $gte: args.dateFrom, $lte: args.dateTo },
      overtimeHours: { $gt: 0 },
    };
    if (employeeIds) match.employee = { $in: employeeIds };

    const [trend, perEmployee] = await Promise.all([
      // Reuses the same aggregation the Reports screen charts, rather than
      // writing a second one that could drift from it.
      reportService.overtimeTrends(args.dateFrom, args.dateTo, departmentId),
      Attendance.aggregate([
        { $match: match },
        { $group: { _id: '$employee', overtimeHours: { $sum: '$overtimeHours' }, days: { $sum: 1 } } },
        { $sort: { overtimeHours: -1 } },
        { $limit: ASSISTANT_MAX_ROWS },
      ]),
    ]);

    const employees = await Employee.find({ _id: { $in: perEmployee.map((row) => row._id) } })
      .select(EMPLOYEE_FIELDS)
      .populate<{ department: { name: string } }>('department', 'name');
    const byId = new Map(employees.map((employee) => [employee.id as string, employee]));

    return {
      dateFrom: toISODate(args.dateFrom),
      dateTo: toISODate(args.dateTo),
      totalOvertimeHours: Math.round(perEmployee.reduce((sum, row) => sum + row.overtimeHours, 0) * 100) / 100,
      dailyTrend: trend,
      topEmployees: perEmployee.map((row) => {
        const employee = byId.get(row._id.toString());
        return {
          employeeId: employee?.employeeId,
          name: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown employee',
          department: employee?.department?.name,
          overtimeHours: Math.round(row.overtimeHours * 100) / 100,
          daysWithOvertime: row.days,
        };
      }),
      ...scopeNote(scope, coerced),
    };
  },
});

const getStaffingLevels = defineTool({
  name: 'get_staffing_levels',
  description:
    'Required vs. assigned staff per day over a date range, plus the shifts that are short. Use for "which department is understaffed", "are we covered next week", and open-shift counts.',
  schema: z.object({ department: departmentArg }).merge(dateRange),
  execute: async (args, scope) => {
    assertRange(args.dateFrom, args.dateTo);
    const { departmentId, coerced } = resolveDepartmentFilter(scope, args.department);

    const coverage = await reportService.shiftCoverage(args.dateFrom, args.dateTo, departmentId);

    // The per-shift shortfall list, so "understaffed" can name the actual shifts
    // rather than only a percentage.
    const shiftFilter: Record<string, unknown> = { date: { $gte: args.dateFrom, $lte: args.dateTo } };
    if (departmentId) shiftFilter.department = new Types.ObjectId(departmentId);

    const shifts = await Shift.find(shiftFilter)
      .select('date shiftType startTime endTime requiredStaff department')
      .populate<{ department: { name: string } }>('department', 'name')
      .sort({ date: 1 })
      .limit(500);

    const assignedCounts = await ShiftAssignment.aggregate([
      { $match: { shift: { $in: shifts.map((shift) => shift._id) }, status: { $in: ['assigned', 'confirmed'] } } },
      { $group: { _id: '$shift', count: { $sum: 1 } } },
    ]);
    const assignedByShift = new Map(assignedCounts.map((row) => [row._id.toString(), row.count as number]));

    const shortfalls = shifts
      .map((shift) => {
        const assigned = assignedByShift.get(shift.id as string) ?? 0;
        return {
          shiftId: shift.id as string,
          date: toISODate(shift.date),
          shiftType: shift.shiftType,
          window: `${shift.startTime}–${shift.endTime}`,
          department: shift.department?.name,
          requiredStaff: shift.requiredStaff,
          assignedStaff: assigned,
          shortBy: shift.requiredStaff - assigned,
        };
      })
      .filter((shift) => shift.shortBy > 0)
      .sort((a, b) => b.shortBy - a.shortBy)
      .slice(0, ASSISTANT_MAX_ROWS);

    const totalRequired = coverage.reduce((sum, day) => sum + day.requiredStaff, 0);
    const totalAssigned = coverage.reduce((sum, day) => sum + day.assignedStaff, 0);

    return {
      dateFrom: toISODate(args.dateFrom),
      dateTo: toISODate(args.dateTo),
      totalRequiredStaff: totalRequired,
      totalAssignedStaff: totalAssigned,
      coveragePercent: totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 10000) / 100 : 100,
      openPositions: Math.max(0, totalRequired - totalAssigned),
      dailyCoverage: coverage.slice(0, ASSISTANT_MAX_ROWS),
      understaffedShifts: shortfalls,
      ...scopeNote(scope, coerced),
    };
  },
});

const getAttendanceSummary = defineTool({
  name: 'get_attendance_summary',
  description:
    'Attendance over a date range: counts and rates for present, late, absent and on-leave, the day-by-day trend, and the employees with the most absences or late arrivals.',
  schema: z.object({ department: departmentArg }).merge(dateRange),
  execute: async (args, scope) => {
    assertRange(args.dateFrom, args.dateTo);
    const { departmentId, coerced } = resolveDepartmentFilter(scope, args.department);

    const employeeIds = await employeeIdsIn(departmentId);
    const match: Record<string, unknown> = { date: { $gte: args.dateFrom, $lte: args.dateTo } };
    if (employeeIds) match.employee = { $in: employeeIds };

    const [totals, trend, worstAttenders] = await Promise.all([
      Attendance.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
            leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
            hoursWorked: { $sum: { $ifNull: ['$totalHoursWorked', 0] } },
          },
        },
      ]),
      reportService.attendanceTrends(args.dateFrom, args.dateTo, departmentId),
      Attendance.aggregate([
        { $match: { ...match, status: { $in: ['absent', 'late'] } } },
        {
          $group: {
            _id: '$employee',
            absences: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
            lateArrivals: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          },
        },
        { $sort: { absences: -1, lateArrivals: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const stats = totals[0] ?? { total: 0, present: 0, late: 0, absent: 0, leave: 0, hoursWorked: 0 };
    const employees = await Employee.find({ _id: { $in: worstAttenders.map((row) => row._id) } }).select(
      EMPLOYEE_FIELDS
    );
    const byId = new Map(employees.map((employee) => [employee.id as string, employee]));

    const rate = (count: number) => (stats.total > 0 ? Math.round((count / stats.total) * 10000) / 100 : 0);

    return {
      dateFrom: toISODate(args.dateFrom),
      dateTo: toISODate(args.dateTo),
      recordCount: stats.total,
      present: stats.present,
      late: stats.late,
      absent: stats.absent,
      onLeave: stats.leave,
      attendanceRatePercent: rate(stats.present + stats.late),
      lateRatePercent: rate(stats.late),
      absenceRatePercent: rate(stats.absent),
      totalHoursWorked: Math.round(stats.hoursWorked * 100) / 100,
      dailyTrend: trend.slice(0, ASSISTANT_MAX_ROWS),
      mostAbsences: worstAttenders.map((row) => {
        const employee = byId.get(row._id.toString());
        return {
          employeeId: employee?.employeeId,
          name: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown employee',
          absences: row.absences,
          lateArrivals: row.lateArrivals,
        };
      }),
      ...scopeNote(scope, coerced),
    };
  },
});

const getUpcomingLeave = defineTool({
  name: 'get_upcoming_leave',
  description:
    'Leave requests overlapping a date range, with who is off, when, the leave type, and where each request sits in the two-stage approval flow (pending → department_approved → approved).',
  schema: z
    .object({
      department: departmentArg,
      status: z
        .enum(['pending', 'department_approved', 'approved', 'rejected', 'cancelled'])
        .optional()
        .describe('Filter to one approval state. Omit for all states except cancelled.'),
    })
    .merge(dateRange),
  execute: async (args, scope) => {
    assertRange(args.dateFrom, args.dateTo);
    const { departmentId, coerced } = resolveDepartmentFilter(scope, args.department);

    const employeeIds = await employeeIdsIn(departmentId);
    const filter: Record<string, unknown> = {
      startDate: { $lte: args.dateTo },
      endDate: { $gte: args.dateFrom },
      status: args.status ?? { $ne: 'cancelled' },
    };
    if (employeeIds) filter.employee = { $in: employeeIds };

    const requests = await LeaveRequest.find(filter)
      .select('leaveType startDate endDate totalDays status employee')
      .populate<{ employee: { firstName: string; lastName: string; employeeId: string } }>(
        'employee',
        EMPLOYEE_FIELDS
      )
      .sort({ startDate: 1 })
      .limit(ASSISTANT_MAX_ROWS);

    const byType: Record<string, number> = {};
    for (const leave of requests) {
      byType[leave.leaveType] = (byType[leave.leaveType] ?? 0) + 1;
    }

    return {
      dateFrom: toISODate(args.dateFrom),
      dateTo: toISODate(args.dateTo),
      requestCount: requests.length,
      totalDaysRequested: Math.round(requests.reduce((sum, leave) => sum + leave.totalDays, 0) * 10) / 10,
      countByType: byType,
      requests: requests.map((leave) => ({
        employeeId: leave.employee?.employeeId,
        name: leave.employee ? `${leave.employee.firstName} ${leave.employee.lastName}` : 'Unknown employee',
        leaveType: leave.leaveType,
        startDate: toISODate(leave.startDate),
        endDate: toISODate(leave.endDate),
        totalDays: leave.totalDays,
        status: leave.status,
      })),
      ...scopeNote(scope, coerced),
    };
  },
});

const getExpiringCertifications = defineTool({
  name: 'get_expiring_certifications',
  description:
    'Employee certifications that have expired or expire within the next N days. Use for compliance questions and to explain why someone is not eligible for a certification-gated shift.',
  schema: z.object({
    department: departmentArg,
    withinDays: z
      .number()
      .int()
      .min(0)
      .max(ASSISTANT_MAX_RANGE_DAYS)
      .default(90)
      .describe('Look-ahead window in days. Already-expired certifications are always included.'),
  }),
  execute: async (args, scope) => {
    const { departmentId, coerced } = resolveDepartmentFilter(scope, args.department);

    const now = new Date();
    const horizon = new Date(now.getTime() + args.withinDays * 24 * 60 * 60 * 1000);

    const filter: Record<string, unknown> = {
      status: 'active',
      'certifications.expiryDate': { $lte: horizon },
    };
    if (departmentId) filter.department = departmentId;

    const employees = await Employee.find(filter)
      .select(`${EMPLOYEE_FIELDS} certifications`)
      .populate<{ department: { name: string } }>('department', 'name')
      .limit(ASSISTANT_MAX_ROWS);

    const certificationIds = employees.flatMap((employee) =>
      employee.certifications.map((entry) => entry.certification)
    );
    const certifications = await Certification.find({ _id: { $in: certificationIds } }).select('name code');
    const certById = new Map(certifications.map((certification) => [certification.id as string, certification]));

    const rows = employees.flatMap((employee) =>
      employee.certifications
        .filter((entry) => entry.expiryDate && entry.expiryDate <= horizon)
        .map((entry) => {
          const certification = certById.get(entry.certification.toString());
          const daysUntilExpiry = Math.floor(
            (entry.expiryDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          );
          return {
            employeeId: employee.employeeId,
            name: `${employee.firstName} ${employee.lastName}`,
            department: employee.department?.name,
            certification: certification?.name ?? 'Unknown certification',
            certificationCode: certification?.code,
            expiryDate: toISODate(entry.expiryDate!),
            daysUntilExpiry,
            expired: daysUntilExpiry < 0,
          };
        })
    );

    rows.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    return {
      asOf: toISODate(now),
      withinDays: args.withinDays,
      expiredCount: rows.filter((row) => row.expired).length,
      expiringSoonCount: rows.filter((row) => !row.expired).length,
      certifications: rows.slice(0, ASSISTANT_MAX_ROWS),
      ...scopeNote(scope, coerced),
    };
  },
});

const explainShiftStaffing = defineTool({
  name: 'explain_shift_staffing',
  description:
    'For one specific shift, why it is or is not fully staffed: who is assigned, and for every unassigned active employee in that department, the reason they were not eligible — on approved leave, already assigned that day, missing a required certification, or simply available. Use to answer "why couldn\'t X be assigned to this shift".',
  schema: z.object({
    shiftId: z.string().describe('The shift id, as returned in understaffedShifts by get_staffing_levels.'),
  }),
  execute: async (args, scope) => {
    if (!Types.ObjectId.isValid(args.shiftId)) {
      throw ApiError.badRequest(`"${args.shiftId}" is not a valid shift id`);
    }

    const shift = await Shift.findById(args.shiftId)
      .select('date shiftType startTime endTime requiredStaff requiredCertifications department')
      .populate<{ department: { _id: Types.ObjectId; name: string } }>('department', 'name');

    if (!shift) throw ApiError.notFound('No shift with that id');

    // The scope check for a by-id lookup: a department-scoped caller may only
    // open shifts belonging to their own department. Reported as not-found
    // rather than forbidden, so the existence of other departments' shift ids
    // is not probeable through this tool.
    if (scope.mode === 'department' && shift.department?._id.toString() !== scope.departmentId) {
      throw ApiError.notFound('No shift with that id in your department');
    }

    const [assignments, employees, requiredCertifications] = await Promise.all([
      ShiftAssignment.find({ shift: shift._id })
        .select('employee status')
        .populate<{ employee: { firstName: string; lastName: string; employeeId: string } }>(
          'employee',
          EMPLOYEE_FIELDS
        ),
      Employee.find({ department: shift.department?._id, status: 'active' })
        .select(`${EMPLOYEE_FIELDS} certifications`)
        .limit(200),
      Certification.find({ _id: { $in: shift.requiredCertifications } }).select('name code'),
    ]);

    const activeAssignments = assignments.filter((assignment) =>
      ['assigned', 'confirmed'].includes(assignment.status)
    );
    const assignedEmployeeIds = new Set(
      assignments.map((assignment) => assignment.employee?.employeeId).filter(Boolean)
    );

    const employeeIds = employees.map((employee) => employee._id);

    // The two things that make an otherwise-eligible person unavailable on the
    // day: approved leave covering it, and an existing assignment on another
    // shift the same day. Mirrors the constraints the CP-SAT solver is given in
    // services/scheduling/constraintBuilder.ts.
    const [leaveOnDay, sameDayShifts] = await Promise.all([
      LeaveRequest.find({
        employee: { $in: employeeIds },
        status: 'approved',
        startDate: { $lte: shift.date },
        endDate: { $gte: shift.date },
      }).select('employee leaveType startDate endDate'),
      Shift.find({ date: shift.date, _id: { $ne: shift._id } }).select('_id shiftType'),
    ]);

    const leaveByEmployee = new Map(leaveOnDay.map((leave) => [leave.employee.toString(), leave]));

    const sameDayAssignments = await ShiftAssignment.find({
      shift: { $in: sameDayShifts.map((other) => other._id) },
      employee: { $in: employeeIds },
      status: { $in: ['assigned', 'confirmed'] },
    }).select('employee shift');
    const otherShiftById = new Map(sameDayShifts.map((other) => [other.id as string, other]));
    const busyByEmployee = new Map(
      sameDayAssignments.map((assignment) => [
        assignment.employee.toString(),
        otherShiftById.get(assignment.shift.toString())?.shiftType,
      ])
    );

    const requiredCertIds = shift.requiredCertifications.map((id) => id.toString());
    const certNameById = new Map(requiredCertifications.map((c) => [c.id as string, c.name]));

    const candidates = employees
      .filter((employee) => !assignedEmployeeIds.has(employee.employeeId))
      .map((employee) => {
        const held = new Set(
          employee.certifications
            .filter((entry) => !entry.expiryDate || entry.expiryDate > shift.date)
            .map((entry) => entry.certification.toString())
        );
        const missing = requiredCertIds.filter((id) => !held.has(id));

        let reason = 'available';
        let detail: string | undefined;

        if (leaveByEmployee.has(employee.id as string)) {
          reason = 'on_approved_leave';
          detail = `${leaveByEmployee.get(employee.id as string)!.leaveType} leave covering this date`;
        } else if (busyByEmployee.has(employee.id as string)) {
          reason = 'already_assigned_same_day';
          detail = `already on the ${busyByEmployee.get(employee.id as string)} shift that day`;
        } else if (missing.length > 0) {
          reason = 'missing_required_certification';
          detail = `missing ${missing.map((id) => certNameById.get(id) ?? 'a required certification').join(', ')}`;
        }

        return {
          employeeId: employee.employeeId,
          name: `${employee.firstName} ${employee.lastName}`,
          eligibility: reason,
          detail,
        };
      });

    return {
      shiftId: shift.id as string,
      date: toISODate(shift.date),
      shiftType: shift.shiftType,
      window: `${shift.startTime}–${shift.endTime}`,
      department: shift.department?.name,
      requiredStaff: shift.requiredStaff,
      assignedStaff: activeAssignments.length,
      shortBy: Math.max(0, shift.requiredStaff - activeAssignments.length),
      requiredCertifications: requiredCertifications.map((certification) => certification.name),
      assigned: activeAssignments.map((assignment) => ({
        employeeId: assignment.employee?.employeeId,
        name: assignment.employee
          ? `${assignment.employee.firstName} ${assignment.employee.lastName}`
          : 'Unknown employee',
        status: assignment.status,
      })),
      candidateCount: candidates.length,
      availableCount: candidates.filter((candidate) => candidate.eligibility === 'available').length,
      candidates: candidates.slice(0, ASSISTANT_MAX_ROWS),
    };
  },
});

export const ASSISTANT_TOOLS: AssistantTool[] = [
  listDepartments,
  getOvertimeSummary,
  getStaffingLevels,
  getAttendanceSummary,
  getUpcomingLeave,
  getExpiringCertifications,
  explainShiftStaffing,
];

const TOOLS_BY_NAME = new Map(ASSISTANT_TOOLS.map((tool) => [tool.name, tool]));

/**
 * Run one tool call from the model.
 *
 * Arguments are parsed against the tool's own zod schema before the executor
 * sees them, so a hallucinated field never reaches a query, and a validation
 * failure comes back as a tool result the model can correct from rather than as
 * a 500 that ends the conversation.
 */
export async function runTool(
  name: string,
  rawArgs: unknown,
  scope: AssistantScope
): Promise<{ ok: boolean; result: unknown }> {
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) {
    return { ok: false, result: { error: `No tool named "${name}"` } };
  }

  const parsed = tool.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      result: {
        error: 'Invalid arguments',
        details: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
      },
    };
  }

  try {
    const result = await tool.execute(parsed.data, scope);
    return { ok: true, result: stripSensitive(result) };
  } catch (error) {
    // A tool failing is information the model can act on ("that date range is
    // too wide, try a shorter one"), not a reason to abandon the turn.
    const message = error instanceof ApiError ? error.message : 'The query failed';
    return { ok: false, result: { error: message } };
  }
}
