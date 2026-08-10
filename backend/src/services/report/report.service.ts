import { Types } from 'mongoose';
import { Attendance } from '@models/Attendance.model';
import { LeaveRequest } from '@models/LeaveRequest.model';
import { Shift } from '@models/Shift.model';
import { Employee } from '@models/Employee.model';
import { Department } from '@models/Department.model';

async function resolveEmployeeIds(department?: string): Promise<Types.ObjectId[] | undefined> {
  if (!department) return undefined;
  const employees = await Employee.find({ department }).select('_id');
  return employees.map((e) => e._id as Types.ObjectId);
}

function shiftDurationHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
}

export async function attendanceTrends(dateFrom: Date, dateTo: Date, department?: string) {
  const employeeIds = await resolveEmployeeIds(department);
  const match: Record<string, unknown> = { date: { $gte: dateFrom, $lte: dateTo } };
  if (employeeIds) match.employee = { $in: employeeIds };

  const rows = await Attendance.aggregate([
    { $match: match },
    { $group: { _id: { date: '$date', status: '$status' }, count: { $sum: 1 } } },
    { $sort: { '_id.date': 1 } },
  ]);

  const byDate = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const dateKey = new Date(row._id.date).toISOString().slice(0, 10);
    const entry = byDate.get(dateKey) ?? { present: 0, late: 0, absent: 0, leave: 0, holiday: 0, overtime: 0 };
    entry[row._id.status as string] = row.count;
    byDate.set(dateKey, entry);
  }

  return Array.from(byDate.entries()).map(([date, counts]) => ({ date, ...counts }));
}

export async function leaveStatistics(dateFrom: Date, dateTo: Date, department?: string) {
  const employeeIds = await resolveEmployeeIds(department);
  const match: Record<string, unknown> = { startDate: { $lte: dateTo }, endDate: { $gte: dateFrom } };
  if (employeeIds) match.employee = { $in: employeeIds };

  const rows = await LeaveRequest.aggregate([
    { $match: match },
    { $group: { _id: { leaveType: '$leaveType', status: '$status' }, count: { $sum: 1 }, totalDays: { $sum: '$totalDays' } } },
  ]);

  const byType = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const entry = byType.get(row._id.leaveType) ?? { leaveType: row._id.leaveType, total: 0, byStatus: {} };
    (entry.byStatus as Record<string, number>)[row._id.status] = row.count;
    entry.total = (entry.total as number) + row.count;
    byType.set(row._id.leaveType, entry);
  }

  return Array.from(byType.values());
}

export async function overtimeTrends(dateFrom: Date, dateTo: Date, department?: string) {
  const employeeIds = await resolveEmployeeIds(department);
  const match: Record<string, unknown> = { date: { $gte: dateFrom, $lte: dateTo }, overtimeHours: { $gt: 0 } };
  if (employeeIds) match.employee = { $in: employeeIds };

  const rows = await Attendance.aggregate([
    { $match: match },
    { $group: { _id: '$date', overtimeHours: { $sum: '$overtimeHours' } } },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((row) => ({ date: new Date(row._id).toISOString().slice(0, 10), overtimeHours: Math.round(row.overtimeHours * 100) / 100 }));
}

export async function shiftCoverage(dateFrom: Date, dateTo: Date, department?: string) {
  const match: Record<string, unknown> = { date: { $gte: dateFrom, $lte: dateTo } };
  if (department) match.department = new Types.ObjectId(department);

  const rows = await Shift.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'shiftassignments',
        let: { shiftId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$shift', '$$shiftId'] }, status: { $in: ['assigned', 'confirmed'] } } },
        ],
        as: 'activeAssignments',
      },
    },
    {
      $group: {
        _id: '$date',
        requiredStaff: { $sum: '$requiredStaff' },
        assignedStaff: { $sum: { $size: '$activeAssignments' } },
        shiftCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((row) => ({
    date: new Date(row._id).toISOString().slice(0, 10),
    shiftCount: row.shiftCount,
    requiredStaff: row.requiredStaff,
    assignedStaff: row.assignedStaff,
    coveragePercent: row.requiredStaff > 0 ? Math.round((row.assignedStaff / row.requiredStaff) * 10000) / 100 : 100,
  }));
}

export async function departmentUtilization(dateFrom: Date, dateTo: Date) {
  const departments = await Department.find({ isActive: true });
  const results = [];

  for (const department of departments) {
    const employeeIds = await Employee.find({ department: department._id, status: 'active' }).distinct('_id');

    const [workedAgg, shifts] = await Promise.all([
      Attendance.aggregate([
        { $match: { employee: { $in: employeeIds }, date: { $gte: dateFrom, $lte: dateTo } } },
        { $group: { _id: null, totalHours: { $sum: { $ifNull: ['$totalHoursWorked', 0] } } } },
      ]),
      Shift.find({ department: department._id, date: { $gte: dateFrom, $lte: dateTo } }),
    ]);

    const workedHours = workedAgg[0]?.totalHours ?? 0;
    const scheduledHours = shifts.reduce((sum, s) => sum + s.requiredStaff * shiftDurationHours(s.startTime, s.endTime), 0);

    results.push({
      department: department.name,
      departmentId: department.id,
      employeeCount: employeeIds.length,
      workedHours: Math.round(workedHours * 100) / 100,
      scheduledHours: Math.round(scheduledHours * 100) / 100,
      utilizationPercent: scheduledHours > 0 ? Math.round((workedHours / scheduledHours) * 10000) / 100 : 0,
    });
  }

  return results;
}

export async function dashboardSummary(department?: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fourteenDaysAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const employeeIds = await resolveEmployeeIds(department);
  const attendanceMatch: Record<string, unknown> = { date: { $gte: thirtyDaysAgo, $lte: now } };
  if (employeeIds) attendanceMatch.employee = { $in: employeeIds };

  const leaveMatch: Record<string, unknown> = {
    status: 'approved',
    startDate: { $lte: now },
    endDate: { $gte: thirtyDaysAgo },
  };
  if (employeeIds) leaveMatch.employee = { $in: employeeIds };

  const [attendanceStats, coverageUpcoming, approvedLeaveDays] = await Promise.all([
    Attendance.aggregate([
      { $match: attendanceMatch },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          overtimeHours: { $sum: { $ifNull: ['$overtimeHours', 0] } },
        },
      },
    ]),
    shiftCoverage(now, fourteenDaysAhead, department),
    LeaveRequest.aggregate([
      { $match: leaveMatch },
      {
        $project: {
          overlapDays: {
            $add: [
              {
                $divide: [
                  {
                    $subtract: [
                      { $min: ['$endDate', now] },
                      { $max: ['$startDate', thirtyDaysAgo] },
                    ],
                  },
                  1000 * 60 * 60 * 24,
                ],
              },
              1,
            ],
          },
        },
      },
      { $group: { _id: null, totalDays: { $sum: '$overlapDays' } } },
    ]),
  ]);

  const stats = attendanceStats[0] ?? { total: 0, present: 0, late: 0, absent: 0, overtimeHours: 0 };
  const totalRequired = coverageUpcoming.reduce((sum, r) => sum + r.requiredStaff, 0);
  const totalAssigned = coverageUpcoming.reduce((sum, r) => sum + r.assignedStaff, 0);
  const openShifts = coverageUpcoming.reduce((sum, r) => sum + Math.max(0, r.requiredStaff - r.assignedStaff), 0);

  const windowDays = 30;
  const employeeCount = employeeIds ? employeeIds.length : await Employee.countDocuments({ status: 'active' });
  const totalPossibleDays = employeeCount * windowDays;
  const leaveDays = approvedLeaveDays[0]?.totalDays ?? 0;

  return {
    windowDays,
    attendancePercent: stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 10000) / 100 : 0,
    latePercent: stats.total > 0 ? Math.round((stats.late / stats.total) * 10000) / 100 : 0,
    leavePercent: totalPossibleDays > 0 ? Math.round((leaveDays / totalPossibleDays) * 10000) / 100 : 0,
    totalOvertimeHours: Math.round(stats.overtimeHours * 100) / 100,
    upcomingCoveragePercent: totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 10000) / 100 : 100,
    openShiftsNext14Days: openShifts,
  };
}
