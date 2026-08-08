import { Schedule, ISchedule } from '@models/Schedule.model';
import { Shift } from '@models/Shift.model';
import { ShiftAssignment } from '@models/ShiftAssignment.model';
import { Department } from '@models/Department.model';
import { ApiError } from '@utils/ApiError';
import { logger } from '@utils/logger';
import { PaginationParams, buildPaginationMeta } from '@utils/pagination';
import { notifyDepartment } from '@services/notifications/notification.service';

interface ScheduleFilters {
  department?: string;
  month?: number;
  year?: number;
  status?: string;
}

function monthDateRange(month: number, year: number): { startDate: Date; endDate: Date } {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { startDate, endDate };
}

export async function listSchedules(filters: ScheduleFilters, pagination: PaginationParams) {
  const filter: Record<string, unknown> = {};
  if (filters.department) filter.department = filters.department;
  if (filters.month) filter.month = filters.month;
  if (filters.year) filter.year = filters.year;
  if (filters.status) filter.status = filters.status;

  const [docs, total] = await Promise.all([
    Schedule.find(filter).populate('department', 'name code').sort(pagination.sort).skip(pagination.skip).limit(pagination.limit),
    Schedule.countDocuments(filter),
  ]);
  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total) };
}

export async function getSchedule(id: string): Promise<ISchedule> {
  const schedule = await Schedule.findById(id).populate('department', 'name code').populate({
    path: 'shifts',
    populate: { path: 'assignments', populate: { path: 'employee', select: 'firstName lastName employeeId' } },
  });
  if (!schedule) throw ApiError.notFound('Schedule not found');
  return schedule;
}

export async function createSchedule(data: {
  department: string;
  month: number;
  year: number;
  notes?: string;
  generatedBy: string;
}): Promise<ISchedule> {
  const department = await Department.findById(data.department);
  if (!department) throw ApiError.badRequest('Department not found');

  const existing = await Schedule.findOne({ department: data.department, month: data.month, year: data.year });
  if (existing) throw ApiError.conflict('A schedule already exists for this department and month');

  const { startDate, endDate } = monthDateRange(data.month, data.year);

  return Schedule.create({
    department: data.department,
    month: data.month,
    year: data.year,
    startDate,
    endDate,
    notes: data.notes,
    generatedBy: data.generatedBy,
    status: 'draft',
  });
}

export async function updateSchedule(id: string, data: { notes?: string }): Promise<ISchedule> {
  const schedule = await Schedule.findById(id);
  if (!schedule) throw ApiError.notFound('Schedule not found');
  if (schedule.status === 'published' || schedule.status === 'archived') {
    throw ApiError.conflict(`Cannot edit a ${schedule.status} schedule`);
  }
  schedule.notes = data.notes ?? schedule.notes;
  await schedule.save();
  return schedule;
}

export async function deleteSchedule(id: string): Promise<void> {
  const schedule = await Schedule.findById(id);
  if (!schedule) throw ApiError.notFound('Schedule not found');
  if (schedule.status !== 'draft') {
    throw ApiError.conflict('Only draft schedules can be deleted');
  }

  const shiftIds = await Shift.find({ schedule: id }).distinct('_id');
  await ShiftAssignment.deleteMany({ shift: { $in: shiftIds } });
  await Shift.deleteMany({ schedule: id });
  await schedule.deleteOne();
}

export async function publishSchedule(id: string, userId: string): Promise<ISchedule> {
  const schedule = await Schedule.findById(id);
  if (!schedule) throw ApiError.notFound('Schedule not found');
  if (!['draft', 'generated'].includes(schedule.status)) {
    throw ApiError.conflict(`Cannot publish a schedule in "${schedule.status}" status`);
  }

  const shiftCount = await Shift.countDocuments({ schedule: id });
  if (shiftCount === 0) {
    throw ApiError.badRequest('Cannot publish a schedule with no shifts');
  }

  schedule.status = 'published';
  schedule.publishedBy = userId as unknown as typeof schedule.publishedBy;
  schedule.publishedAt = new Date();
  await schedule.save();

  notifyDepartment(schedule.department.toString(), {
    type: 'schedule_published',
    title: 'Schedule published',
    message: `The schedule for ${schedule.month}/${schedule.year} has been published.`,
    relatedEntityType: 'Schedule',
    relatedEntityId: schedule.id,
  }).catch((error) => logger.error('Failed to send schedule-published notifications', error));

  return schedule;
}
