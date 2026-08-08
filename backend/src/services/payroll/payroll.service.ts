import { Attendance } from '@models/Attendance.model';
import { PayrollInput, IPayrollInput } from '@models/PayrollInput.model';
import { Employee } from '@models/Employee.model';
import { Shift, IShift } from '@models/Shift.model';
import { ApiError } from '@utils/ApiError';
import { PaginationParams, buildPaginationMeta } from '@utils/pagination';

const LATE_GRACE_MINUTES = 15;

function combineDateAndTime(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const combined = new Date(date);
  combined.setUTCHours(h, m, 0, 0);
  return combined;
}

function shiftDurationHours(shift: IShift): number {
  const [sh, sm] = shift.startTime.split(':').map(Number);
  const [eh, em] = shift.endTime.split(':').map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
}

export async function generatePayroll(
  periodStart: Date,
  periodEnd: Date,
  departmentId: string | undefined,
  generatedBy: string
): Promise<IPayrollInput[]> {
  const employeeFilter: Record<string, unknown> = { status: 'active' };
  if (departmentId) employeeFilter.department = departmentId;

  const employees = await Employee.find(employeeFilter).select('_id');
  const results: IPayrollInput[] = [];

  for (const employee of employees) {
    const records = await Attendance.find({
      employee: employee._id,
      date: { $gte: periodStart, $lte: periodEnd },
    }).populate<{ shift: IShift }>('shift');

    let totalHoursWorked = 0;
    let overtimeHours = 0;
    let nightDifferentialHours = 0;
    let holidayHours = 0;
    let tardinessMinutes = 0;
    let undertimeMinutes = 0;
    let absences = 0;

    for (const record of records) {
      if (record.status === 'absent') {
        absences += 1;
        continue;
      }

      const hoursWorked = record.totalHoursWorked ?? 0;
      totalHoursWorked += hoursWorked;
      overtimeHours += record.overtimeHours ?? 0;

      const shift = record.shift as unknown as IShift | undefined;
      if (shift?.shiftType === 'night') nightDifferentialHours += hoursWorked;
      if (shift?.shiftType === 'holiday') holidayHours += hoursWorked;

      if (record.status === 'late' && record.clockIn && shift) {
        const scheduledStart = combineDateAndTime(record.date, shift.startTime);
        const lateMinutes = (record.clockIn.time.getTime() - scheduledStart.getTime()) / 60_000;
        if (lateMinutes > LATE_GRACE_MINUTES) tardinessMinutes += lateMinutes - LATE_GRACE_MINUTES;
      }

      if (shift) {
        const expectedHours = shiftDurationHours(shift);
        if (hoursWorked < expectedHours) {
          undertimeMinutes += (expectedHours - hoursWorked) * 60;
        }
      }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;

    const payrollInput = await PayrollInput.findOneAndUpdate(
      { employee: employee._id, periodStart, periodEnd },
      {
        employee: employee._id,
        periodStart,
        periodEnd,
        totalHoursWorked: round2(totalHoursWorked),
        regularHours: round2(Math.max(0, totalHoursWorked - overtimeHours)),
        overtimeHours: round2(overtimeHours),
        nightDifferentialHours: round2(nightDifferentialHours),
        holidayHours: round2(holidayHours),
        tardinessMinutes: Math.round(tardinessMinutes),
        undertimeMinutes: Math.round(undertimeMinutes),
        absences,
        status: 'draft',
        generatedBy,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    results.push(payrollInput);
  }

  return results;
}

interface PayrollFilters {
  employee?: string;
  status?: string;
  periodStart?: Date;
  periodEnd?: Date;
}

export async function listPayrollInputs(filters: PayrollFilters, pagination: PaginationParams) {
  const filter: Record<string, unknown> = {};
  if (filters.employee) filter.employee = filters.employee;
  if (filters.status) filter.status = filters.status;
  if (filters.periodStart) filter.periodStart = { $gte: filters.periodStart };
  if (filters.periodEnd) filter.periodEnd = { $lte: filters.periodEnd };

  const [docs, total] = await Promise.all([
    PayrollInput.find(filter)
      .populate('employee', 'firstName lastName employeeId')
      .sort(pagination.sort)
      .skip(pagination.skip)
      .limit(pagination.limit),
    PayrollInput.countDocuments(filter),
  ]);
  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total) };
}

export async function getPayrollInput(id: string): Promise<IPayrollInput> {
  const payroll = await PayrollInput.findById(id).populate('employee', 'firstName lastName employeeId');
  if (!payroll) throw ApiError.notFound('Payroll input not found');
  return payroll;
}

export async function finalizePayrollInput(id: string): Promise<IPayrollInput> {
  const payroll = await PayrollInput.findById(id);
  if (!payroll) throw ApiError.notFound('Payroll input not found');
  payroll.status = 'finalized';
  await payroll.save();
  return payroll;
}

export async function exportPayrollCsv(periodStart: Date, periodEnd: Date): Promise<string> {
  const rows = await PayrollInput.find({ periodStart, periodEnd }).populate('employee', 'firstName lastName employeeId');

  const header = [
    'Employee ID',
    'Employee Name',
    'Total Hours',
    'Regular Hours',
    'Overtime Hours',
    'Night Differential Hours',
    'Holiday Hours',
    'Tardiness (min)',
    'Undertime (min)',
    'Absences',
    'Status',
  ];

  const escapeCsv = (value: string | number) => {
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [header.join(',')];
  for (const row of rows) {
    const employee = row.employee as unknown as { employeeId: string; firstName: string; lastName: string };
    lines.push(
      [
        employee.employeeId,
        `${employee.firstName} ${employee.lastName}`,
        row.totalHoursWorked,
        row.regularHours,
        row.overtimeHours,
        row.nightDifferentialHours,
        row.holidayHours,
        row.tardinessMinutes,
        row.undertimeMinutes,
        row.absences,
        row.status,
      ]
        .map(escapeCsv)
        .join(',')
    );
  }

  return lines.join('\n');
}
