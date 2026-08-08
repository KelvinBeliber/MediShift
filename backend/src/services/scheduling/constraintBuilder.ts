import { Schedule } from '@models/Schedule.model';
import { Employee } from '@models/Employee.model';
import { LeaveRequest } from '@models/LeaveRequest.model';
import { ApiError } from '@utils/ApiError';
import { DEFAULT_MAX_CONSECUTIVE_DAYS, DEFAULT_MAX_HOURS_PER_WEEK, DEFAULT_MIN_REST_HOURS, DEFAULT_SOLVER_TIME_SECONDS, WEEKS_PER_MONTH } from '@constants/scheduling';
import { EmploymentType } from '@constants/enums';
import { GenerateScheduleRequest } from './types';
import { ensureShiftSlots } from './shiftGeneration.service';

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function expandDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= last) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function buildGenerationPayload(scheduleId: string): Promise<GenerateScheduleRequest> {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) throw ApiError.notFound('Schedule not found');

  const shifts = await ensureShiftSlots(scheduleId);

  const employees = await Employee.find({ department: schedule.department, status: 'active' });

  const employeeIds = employees.map((e) => e._id);
  const approvedLeave = await LeaveRequest.find({
    employee: { $in: employeeIds },
    status: 'approved',
    startDate: { $lte: schedule.endDate },
    endDate: { $gte: schedule.startDate },
  });

  const unavailableByEmployee = new Map<string, Set<string>>();
  for (const leave of approvedLeave) {
    const key = leave.employee.toString();
    const dates = expandDateRange(
      leave.startDate > schedule.startDate ? leave.startDate : schedule.startDate,
      leave.endDate < schedule.endDate ? leave.endDate : schedule.endDate
    );
    const set = unavailableByEmployee.get(key) ?? new Set<string>();
    dates.forEach((d) => set.add(toISODate(d)));
    unavailableByEmployee.set(key, set);
  }

  const employeeInputs = employees.map((employee) => {
    const maxHoursPerWeek = DEFAULT_MAX_HOURS_PER_WEEK[employee.employmentType as EmploymentType];
    return {
      employeeId: employee.id,
      certifications: employee.certifications
        .filter((c) => !c.expiryDate || c.expiryDate > schedule.endDate)
        .map((c) => c.certification.toString()),
      maxHoursPerWeek,
      maxHoursPerMonth: Math.round(maxHoursPerWeek * WEEKS_PER_MONTH),
      maxConsecutiveDays: DEFAULT_MAX_CONSECUTIVE_DAYS,
      minRestHours: DEFAULT_MIN_REST_HOURS,
      unavailableDates: Array.from(unavailableByEmployee.get(employee.id) ?? []),
      preferredShiftTypes: [] as string[],
    };
  });

  const shiftInputs = shifts.map((shift) => ({
    shiftId: shift.id,
    date: toISODate(shift.date),
    shiftType: shift.shiftType,
    startTime: shift.startTime,
    endTime: shift.endTime,
    requiredStaff: shift.requiredStaff,
    requiredCertifications: shift.requiredCertifications.map((c) => c.toString()),
  }));

  return {
    scheduleId: schedule.id,
    startDate: toISODate(schedule.startDate),
    endDate: toISODate(schedule.endDate),
    shifts: shiftInputs,
    employees: employeeInputs,
    options: { maxSolverTimeSeconds: DEFAULT_SOLVER_TIME_SECONDS },
  };
}
