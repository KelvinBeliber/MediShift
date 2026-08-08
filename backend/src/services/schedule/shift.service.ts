import { Types } from 'mongoose';
import { Shift, IShift } from '@models/Shift.model';
import { Schedule } from '@models/Schedule.model';
import { ShiftAssignment } from '@models/ShiftAssignment.model';
import { ApiError } from '@utils/ApiError';
import { PaginationParams, buildPaginationMeta } from '@utils/pagination';

interface ShiftFilters {
  schedule?: string;
  department?: string;
  dateFrom?: Date;
  dateTo?: Date;
  shiftType?: string;
}

async function assertScheduleEditable(scheduleId: string) {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) throw ApiError.badRequest('Schedule not found');
  if (schedule.status === 'published' || schedule.status === 'archived') {
    throw ApiError.conflict(`Cannot modify shifts on a ${schedule.status} schedule`);
  }
  return schedule;
}

export async function listShifts(filters: ShiftFilters, pagination: PaginationParams) {
  const filter: Record<string, unknown> = {};
  if (filters.schedule) filter.schedule = filters.schedule;
  if (filters.department) filter.department = filters.department;
  if (filters.shiftType) filter.shiftType = filters.shiftType;
  if (filters.dateFrom || filters.dateTo) {
    filter.date = {
      ...(filters.dateFrom ? { $gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { $lte: filters.dateTo } : {}),
    };
  }

  const [docs, total] = await Promise.all([
    Shift.find(filter)
      .populate('department', 'name code')
      .populate({ path: 'assignments', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
      .sort(pagination.sort)
      .skip(pagination.skip)
      .limit(pagination.limit),
    Shift.countDocuments(filter),
  ]);
  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total) };
}

export async function getShift(id: string): Promise<IShift> {
  const shift = await Shift.findById(id)
    .populate('department', 'name code')
    .populate({ path: 'assignments', populate: { path: 'employee', select: 'firstName lastName employeeId' } });
  if (!shift) throw ApiError.notFound('Shift not found');
  return shift;
}

export async function createShift(data: Partial<IShift> & { schedule: string }): Promise<IShift> {
  const schedule = await assertScheduleEditable(data.schedule);

  return Shift.create({
    ...data,
    department: data.department ?? schedule.department,
  });
}

export async function updateShift(id: string, data: Partial<IShift>): Promise<IShift> {
  const shift = await Shift.findById(id);
  if (!shift) throw ApiError.notFound('Shift not found');
  await assertScheduleEditable(shift.schedule.toString());

  Object.assign(shift, data);
  await shift.save();
  return shift;
}

export async function deleteShift(id: string): Promise<void> {
  const shift = await Shift.findById(id);
  if (!shift) throw ApiError.notFound('Shift not found');
  await assertScheduleEditable(shift.schedule.toString());

  await ShiftAssignment.deleteMany({ shift: shift._id as Types.ObjectId });
  await shift.deleteOne();
}
