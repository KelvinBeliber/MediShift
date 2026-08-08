import { Types } from 'mongoose';
import { Attendance, IAttendance } from '@models/Attendance.model';
import { ShiftAssignment } from '@models/ShiftAssignment.model';
import { Shift, IShift } from '@models/Shift.model';
import { Employee } from '@models/Employee.model';
import { ApiError } from '@utils/ApiError';
import { PaginationParams, buildPaginationMeta } from '@utils/pagination';

const LATE_GRACE_MINUTES = 15;
const STANDARD_SHIFT_HOURS = 8;

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function combineDateAndTime(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const combined = new Date(date);
  combined.setUTCHours(h, m, 0, 0);
  return combined;
}

async function findTodaysShift(employeeId: string, date: Date): Promise<IShift | null> {
  const assignment = await ShiftAssignment.findOne({
    employee: employeeId,
    status: { $in: ['assigned', 'confirmed'] },
  }).populate<{ shift: IShift }>('shift');

  if (!assignment) return null;
  const shift = assignment.shift as unknown as IShift;
  if (!shift || startOfDay(shift.date).getTime() !== startOfDay(date).getTime()) return null;
  return shift;
}

export async function clockIn(employeeId: string, method: 'manual' | 'gps' | 'qr', location?: { lat: number; lng: number }) {
  const employee = await Employee.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const now = new Date();
  const today = startOfDay(now);

  let attendance = await Attendance.findOne({ employee: employeeId, date: today });
  if (attendance?.clockIn) {
    throw ApiError.conflict('Already clocked in for today');
  }

  const shift = await findTodaysShift(employeeId, today);
  let status: IAttendance['status'] = 'present';
  if (shift) {
    const scheduledStart = combineDateAndTime(today, shift.startTime);
    const graceDeadline = new Date(scheduledStart.getTime() + LATE_GRACE_MINUTES * 60_000);
    if (now > graceDeadline) status = 'late';
  }

  const clockInEvent = { time: now, method, location };

  if (attendance) {
    attendance.clockIn = clockInEvent;
    attendance.status = status;
    await attendance.save();
  } else {
    attendance = await Attendance.create({
      employee: employeeId,
      shift: shift?._id,
      date: today,
      clockIn: clockInEvent,
      status,
    });
  }

  return attendance;
}

export async function clockOut(employeeId: string, method: 'manual' | 'gps' | 'qr', location?: { lat: number; lng: number }) {
  const today = startOfDay(new Date());
  const attendance = await Attendance.findOne({ employee: employeeId, date: today });
  if (!attendance || !attendance.clockIn) {
    throw ApiError.badRequest('No active clock-in found for today');
  }
  if (attendance.clockOut) {
    throw ApiError.conflict('Already clocked out for today');
  }

  const now = new Date();
  attendance.clockOut = { time: now, method, location };

  const breakMinutes = attendance.breaks.reduce((total, b) => {
    if (!b.end) return total;
    return total + (b.end.getTime() - b.start.getTime()) / 60_000;
  }, 0);

  const grossMinutes = (now.getTime() - attendance.clockIn.time.getTime()) / 60_000;
  const netHours = Math.max(0, (grossMinutes - breakMinutes) / 60);
  attendance.totalHoursWorked = Math.round(netHours * 100) / 100;

  let expectedHours = STANDARD_SHIFT_HOURS;
  if (attendance.shift) {
    const shift = await Shift.findById(attendance.shift);
    if (shift) {
      const start = combineDateAndTime(today, shift.startTime);
      let end = combineDateAndTime(today, shift.endTime);
      if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      expectedHours = (end.getTime() - start.getTime()) / 3_600_000;
    }
  }

  const overtime = Math.max(0, netHours - expectedHours);
  attendance.overtimeHours = Math.round(overtime * 100) / 100;
  if (overtime > 0) attendance.status = 'overtime';

  await attendance.save();
  return attendance;
}

export async function breakStart(employeeId: string) {
  const today = startOfDay(new Date());
  const attendance = await Attendance.findOne({ employee: employeeId, date: today });
  if (!attendance || !attendance.clockIn || attendance.clockOut) {
    throw ApiError.badRequest('Must be clocked in (and not yet clocked out) to start a break');
  }
  const openBreak = attendance.breaks.find((b) => !b.end);
  if (openBreak) throw ApiError.conflict('A break is already in progress');

  attendance.breaks.push({ start: new Date() });
  await attendance.save();
  return attendance;
}

export async function breakEnd(employeeId: string) {
  const today = startOfDay(new Date());
  const attendance = await Attendance.findOne({ employee: employeeId, date: today });
  if (!attendance) throw ApiError.badRequest('No attendance record found for today');

  const openBreak = attendance.breaks.find((b) => !b.end);
  if (!openBreak) throw ApiError.badRequest('No break is currently in progress');

  openBreak.end = new Date();
  await attendance.save();
  return attendance;
}

interface AttendanceFilters {
  employee?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: string;
}

export async function listAttendance(filters: AttendanceFilters, pagination: PaginationParams) {
  const filter: Record<string, unknown> = {};
  if (filters.employee) filter.employee = filters.employee;
  if (filters.status) filter.status = filters.status;
  if (filters.dateFrom || filters.dateTo) {
    filter.date = {
      ...(filters.dateFrom ? { $gte: startOfDay(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { $lte: startOfDay(filters.dateTo) } : {}),
    };
  }

  const [docs, total] = await Promise.all([
    Attendance.find(filter)
      .populate('employee', 'firstName lastName employeeId')
      .sort(pagination.sort)
      .skip(pagination.skip)
      .limit(pagination.limit),
    Attendance.countDocuments(filter),
  ]);
  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total) };
}

export async function getToday(employeeId: string): Promise<IAttendance | null> {
  const today = startOfDay(new Date());
  return Attendance.findOne({ employee: employeeId, date: today });
}

export async function getAttendance(id: string): Promise<IAttendance> {
  const attendance = await Attendance.findById(id).populate('employee', 'firstName lastName employeeId');
  if (!attendance) throw ApiError.notFound('Attendance record not found');
  return attendance;
}

export async function getSummary(employeeId: string | undefined, dateFrom: Date, dateTo: Date) {
  const match: Record<string, unknown> = {
    date: { $gte: startOfDay(dateFrom), $lte: startOfDay(dateTo) },
  };
  if (employeeId) match.employee = new Types.ObjectId(employeeId);

  const rows = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$employee',
        totalHoursWorked: { $sum: { $ifNull: ['$totalHoursWorked', 0] } },
        totalOvertimeHours: { $sum: { $ifNull: ['$overtimeHours', 0] } },
        presentDays: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        lateDays: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        absentDays: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        overtimeDays: { $sum: { $cond: [{ $eq: ['$status', 'overtime'] }, 1, 0] } },
        totalRecords: { $sum: 1 },
      },
    },
    { $lookup: { from: 'employees', localField: '_id', foreignField: '_id', as: 'employee' } },
    { $unwind: '$employee' },
    {
      $project: {
        _id: 0,
        employeeId: '$_id',
        employeeName: { $concat: ['$employee.firstName', ' ', '$employee.lastName'] },
        totalHoursWorked: { $round: ['$totalHoursWorked', 2] },
        totalOvertimeHours: { $round: ['$totalOvertimeHours', 2] },
        presentDays: 1,
        lateDays: 1,
        absentDays: 1,
        overtimeDays: 1,
        totalRecords: 1,
      },
    },
  ]);

  return rows;
}

export async function markAbsentees(date: Date): Promise<{ marked: number }> {
  const day = startOfDay(date);
  const assignments = await ShiftAssignment.find({ status: { $in: ['assigned', 'confirmed'] } }).populate<{
    shift: IShift;
  }>('shift');

  const dueAssignments = assignments.filter((a) => {
    const shift = a.shift as unknown as IShift;
    return shift && startOfDay(shift.date).getTime() === day.getTime();
  });

  let marked = 0;
  for (const assignment of dueAssignments) {
    const existing = await Attendance.findOne({ employee: assignment.employee, date: day });
    if (existing?.clockIn) continue;

    await Attendance.findOneAndUpdate(
      { employee: assignment.employee, date: day },
      { $setOnInsert: { employee: assignment.employee, date: day, shift: assignment.shift }, $set: { status: 'absent' } },
      { upsert: true }
    );
    marked += 1;
  }

  return { marked };
}
