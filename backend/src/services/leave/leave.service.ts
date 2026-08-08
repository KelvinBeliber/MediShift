import { Types } from 'mongoose';
import { LeaveRequest, ILeaveRequest } from '@models/LeaveRequest.model';
import { ShiftAssignment } from '@models/ShiftAssignment.model';
import { Shift } from '@models/Shift.model';
import { Employee } from '@models/Employee.model';
import { ApiError } from '@utils/ApiError';
import { logger } from '@utils/logger';
import { PaginationParams, buildPaginationMeta } from '@utils/pagination';
import { notifyEmployee } from '@services/notifications/notification.service';

function daysBetweenInclusive(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

interface LeaveFilters {
  employee?: string;
  status?: string;
  leaveType?: string;
}

export async function listLeaveRequests(filters: LeaveFilters, pagination: PaginationParams) {
  const filter: Record<string, unknown> = {};
  if (filters.employee) filter.employee = filters.employee;
  if (filters.status) filter.status = filters.status;
  if (filters.leaveType) filter.leaveType = filters.leaveType;

  const [docs, total] = await Promise.all([
    LeaveRequest.find(filter)
      .populate('employee', 'firstName lastName employeeId')
      .sort(pagination.sort)
      .skip(pagination.skip)
      .limit(pagination.limit),
    LeaveRequest.countDocuments(filter),
  ]);
  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total) };
}

export async function getLeaveRequest(id: string): Promise<ILeaveRequest> {
  const leave = await LeaveRequest.findById(id).populate('employee', 'firstName lastName employeeId');
  if (!leave) throw ApiError.notFound('Leave request not found');
  return leave;
}

export async function createLeaveRequest(data: {
  employeeId: string;
  leaveType: ILeaveRequest['leaveType'];
  startDate: Date;
  endDate: Date;
  reason?: string;
}): Promise<ILeaveRequest> {
  const employee = await Employee.findById(data.employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const overlapping = await LeaveRequest.findOne({
    employee: data.employeeId,
    status: { $in: ['pending', 'department_approved', 'approved'] },
    startDate: { $lte: data.endDate },
    endDate: { $gte: data.startDate },
  });
  if (overlapping) {
    throw ApiError.conflict('This employee already has a leave request covering an overlapping date range');
  }

  return LeaveRequest.create({
    employee: data.employeeId,
    leaveType: data.leaveType,
    startDate: data.startDate,
    endDate: data.endDate,
    totalDays: daysBetweenInclusive(data.startDate, data.endDate),
    reason: data.reason,
    status: 'pending',
  });
}

export async function cancelLeaveRequest(id: string, employeeId: string): Promise<ILeaveRequest> {
  const leave = await LeaveRequest.findById(id);
  if (!leave) throw ApiError.notFound('Leave request not found');
  if (leave.employee.toString() !== employeeId) {
    throw ApiError.forbidden('You can only cancel your own leave requests');
  }
  if (leave.status !== 'pending') {
    throw ApiError.conflict('Only pending leave requests can be cancelled');
  }
  leave.status = 'cancelled';
  await leave.save();
  return leave;
}

export async function departmentApprove(id: string, approvedBy: string, comment?: string): Promise<ILeaveRequest> {
  const leave = await LeaveRequest.findById(id);
  if (!leave) throw ApiError.notFound('Leave request not found');
  if (leave.status !== 'pending') {
    throw ApiError.conflict(`Cannot department-approve a request in "${leave.status}" status`);
  }
  leave.departmentApproval = { approvedBy: approvedBy as unknown as Types.ObjectId, approvedAt: new Date(), comment };
  leave.status = 'department_approved';
  await leave.save();
  return leave;
}

export async function hrApprove(id: string, approvedBy: string, comment?: string): Promise<ILeaveRequest> {
  const leave = await LeaveRequest.findById(id);
  if (!leave) throw ApiError.notFound('Leave request not found');
  if (leave.status !== 'department_approved') {
    throw ApiError.conflict('Leave request must be department-approved before HR approval');
  }
  leave.hrApproval = { approvedBy: approvedBy as unknown as Types.ObjectId, approvedAt: new Date(), comment };
  leave.status = 'approved';
  await leave.save();

  // Schedule automatically updates: pull the employee off any shifts already
  // assigned during the approved leave window.
  const shiftsInRange = await Shift.find({ date: { $gte: leave.startDate, $lte: leave.endDate } }).distinct('_id');
  if (shiftsInRange.length > 0) {
    await ShiftAssignment.updateMany(
      { employee: leave.employee, shift: { $in: shiftsInRange }, status: { $in: ['assigned', 'confirmed'] } },
      { $set: { status: 'declined', notes: 'Auto-declined: approved leave' } }
    );
  }

  notifyEmployee(leave.employee.toString(), {
    type: 'leave_approved',
    title: 'Leave request approved',
    message: `Your ${leave.leaveType} leave request has been approved.`,
    relatedEntityType: 'LeaveRequest',
    relatedEntityId: leave.id,
  }).catch((error) => logger.error('Failed to send leave-approved notification', error));

  return leave;
}

export async function rejectLeaveRequest(id: string, rejectionReason: string): Promise<ILeaveRequest> {
  const leave = await LeaveRequest.findById(id);
  if (!leave) throw ApiError.notFound('Leave request not found');
  if (!['pending', 'department_approved'].includes(leave.status)) {
    throw ApiError.conflict(`Cannot reject a request in "${leave.status}" status`);
  }
  leave.status = 'rejected';
  leave.rejectionReason = rejectionReason;
  await leave.save();

  notifyEmployee(leave.employee.toString(), {
    type: 'leave_rejected',
    title: 'Leave request rejected',
    message: `Your ${leave.leaveType} leave request was rejected: ${rejectionReason}`,
    relatedEntityType: 'LeaveRequest',
    relatedEntityId: leave.id,
  }).catch((error) => logger.error('Failed to send leave-rejected notification', error));

  return leave;
}
