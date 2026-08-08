import { ShiftSwapRequest, IShiftSwapRequest } from '@models/ShiftSwapRequest.model';
import { ShiftAssignment } from '@models/ShiftAssignment.model';
import { Shift, IShift } from '@models/Shift.model';
import { ApiError } from '@utils/ApiError';
import { logger } from '@utils/logger';
import { PaginationParams, buildPaginationMeta } from '@utils/pagination';
import { assertNoDoubleBooking } from '@services/schedule/shiftAssignment.service';
import { notifyEmployee } from '@services/notifications/notification.service';

interface CreateSwapInput {
  requestingEmployeeId: string;
  requestingShift: string;
  targetEmployee?: string;
  targetShift?: string;
  reason?: string;
}

export async function createSwapRequest(data: CreateSwapInput): Promise<IShiftSwapRequest> {
  const requestingAssignment = await ShiftAssignment.findOne({
    shift: data.requestingShift,
    employee: data.requestingEmployeeId,
    status: { $in: ['assigned', 'confirmed'] },
  });
  if (!requestingAssignment) {
    throw ApiError.badRequest('You are not currently assigned to the shift you want to swap');
  }

  if (data.targetShift) {
    if (!data.targetEmployee) {
      throw ApiError.badRequest('targetEmployee is required when proposing a direct shift swap');
    }
    const targetAssignment = await ShiftAssignment.findOne({
      shift: data.targetShift,
      employee: data.targetEmployee,
      status: { $in: ['assigned', 'confirmed'] },
    });
    if (!targetAssignment) {
      throw ApiError.badRequest('The target employee is not currently assigned to the target shift');
    }
  }

  const swap = await ShiftSwapRequest.create({
    requestingEmployee: data.requestingEmployeeId,
    requestingShift: data.requestingShift,
    targetEmployee: data.targetEmployee,
    targetShift: data.targetShift,
    reason: data.reason,
    status: 'pending',
  });

  if (data.targetEmployee) {
    notifyEmployee(data.targetEmployee, {
      type: 'shift_swap_requested',
      title: 'New shift swap request',
      message: 'A colleague has requested to swap a shift with you.',
      relatedEntityType: 'ShiftSwapRequest',
      relatedEntityId: swap.id,
    }).catch((error) => logger.error('Failed to send shift-swap-requested notification', error));
  }

  return swap;
}

export async function acceptSwapRequest(id: string, acceptingEmployeeId: string): Promise<IShiftSwapRequest> {
  const swap = await ShiftSwapRequest.findById(id);
  if (!swap) throw ApiError.notFound('Shift swap request not found');
  if (swap.status !== 'pending') {
    throw ApiError.conflict(`Cannot accept a swap request in "${swap.status}" status`);
  }
  if (swap.targetEmployee && swap.targetEmployee.toString() !== acceptingEmployeeId) {
    throw ApiError.forbidden('This swap request was directed at a different employee');
  }

  if (!swap.targetEmployee) {
    swap.targetEmployee = acceptingEmployeeId as unknown as typeof swap.targetEmployee;
  }
  swap.status = 'accepted';
  swap.acceptedAt = new Date();
  await swap.save();
  return swap;
}

export async function approveSwapRequest(id: string, approvedByUserId: string): Promise<IShiftSwapRequest> {
  const swap = await ShiftSwapRequest.findById(id);
  if (!swap) throw ApiError.notFound('Shift swap request not found');
  if (swap.status !== 'accepted') {
    throw ApiError.conflict('Swap request must be accepted by the target employee before manager approval');
  }
  if (!swap.targetEmployee) {
    throw ApiError.conflict('Swap request has no target employee');
  }

  const requestingAssignment = await ShiftAssignment.findOne({
    shift: swap.requestingShift,
    employee: swap.requestingEmployee,
    status: { $in: ['assigned', 'confirmed'] },
  });
  if (!requestingAssignment) {
    throw ApiError.conflict('The original shift assignment no longer exists');
  }

  const requestingShift = await Shift.findById(swap.requestingShift);
  if (!requestingShift) throw ApiError.notFound('Requesting shift not found');

  if (swap.targetShift) {
    const targetAssignment = await ShiftAssignment.findOne({
      shift: swap.targetShift,
      employee: swap.targetEmployee,
      status: { $in: ['assigned', 'confirmed'] },
    });
    if (!targetAssignment) {
      throw ApiError.conflict('The target shift assignment no longer exists');
    }
    const targetShift = await Shift.findById(swap.targetShift);
    if (!targetShift) throw ApiError.notFound('Target shift not found');

    await assertNoDoubleBooking(swap.targetEmployee.toString(), requestingShift as unknown as IShift, swap.targetShift.toString());
    await assertNoDoubleBooking(
      swap.requestingEmployee.toString(),
      targetShift as unknown as IShift,
      swap.requestingShift.toString()
    );

    requestingAssignment.employee = swap.targetEmployee;
    targetAssignment.employee = swap.requestingEmployee;
    await requestingAssignment.save();
    await targetAssignment.save();
  } else {
    await assertNoDoubleBooking(swap.targetEmployee.toString(), requestingShift as unknown as IShift, swap.requestingShift.toString());
    requestingAssignment.employee = swap.targetEmployee;
    await requestingAssignment.save();
  }

  swap.status = 'manager_approved';
  swap.approvedBy = approvedByUserId as unknown as typeof swap.approvedBy;
  swap.approvedAt = new Date();
  await swap.save();

  const notifyBoth = Promise.all([
    notifyEmployee(swap.requestingEmployee.toString(), {
      type: 'shift_swap_approved',
      title: 'Shift swap approved',
      message: 'Your shift swap request has been approved and the schedule has been updated.',
      relatedEntityType: 'ShiftSwapRequest',
      relatedEntityId: swap.id,
    }),
    notifyEmployee(swap.targetEmployee.toString(), {
      type: 'shift_swap_approved',
      title: 'Shift swap approved',
      message: 'A shift swap involving you has been approved and the schedule has been updated.',
      relatedEntityType: 'ShiftSwapRequest',
      relatedEntityId: swap.id,
    }),
  ]);
  notifyBoth.catch((error) => logger.error('Failed to send shift-swap-approved notifications', error));

  return swap;
}

export async function rejectSwapRequest(id: string, rejectionReason: string): Promise<IShiftSwapRequest> {
  const swap = await ShiftSwapRequest.findById(id);
  if (!swap) throw ApiError.notFound('Shift swap request not found');
  if (!['pending', 'accepted'].includes(swap.status)) {
    throw ApiError.conflict(`Cannot reject a swap request in "${swap.status}" status`);
  }
  swap.status = 'rejected';
  swap.rejectionReason = rejectionReason;
  await swap.save();
  return swap;
}

export async function cancelSwapRequest(id: string, requestingEmployeeId: string): Promise<IShiftSwapRequest> {
  const swap = await ShiftSwapRequest.findById(id);
  if (!swap) throw ApiError.notFound('Shift swap request not found');
  if (swap.requestingEmployee.toString() !== requestingEmployeeId) {
    throw ApiError.forbidden('You can only cancel your own swap requests');
  }
  if (swap.status !== 'pending') {
    throw ApiError.conflict('Only pending swap requests can be cancelled');
  }
  swap.status = 'cancelled';
  await swap.save();
  return swap;
}

interface SwapFilters {
  employee?: string;
  status?: string;
}

export async function listSwapRequests(filters: SwapFilters, pagination: PaginationParams) {
  const filter: Record<string, unknown> = {};
  if (filters.employee) {
    filter.$or = [{ requestingEmployee: filters.employee }, { targetEmployee: filters.employee }];
  }
  if (filters.status) filter.status = filters.status;

  const [docs, total] = await Promise.all([
    ShiftSwapRequest.find(filter)
      .populate('requestingEmployee', 'firstName lastName employeeId')
      .populate('targetEmployee', 'firstName lastName employeeId')
      .populate('requestingShift')
      .populate('targetShift')
      .sort(pagination.sort)
      .skip(pagination.skip)
      .limit(pagination.limit),
    ShiftSwapRequest.countDocuments(filter),
  ]);
  return { docs, meta: buildPaginationMeta(pagination.page, pagination.limit, total) };
}

export async function getSwapRequest(id: string): Promise<IShiftSwapRequest> {
  const swap = await ShiftSwapRequest.findById(id)
    .populate('requestingEmployee', 'firstName lastName employeeId')
    .populate('targetEmployee', 'firstName lastName employeeId')
    .populate('requestingShift')
    .populate('targetShift');
  if (!swap) throw ApiError.notFound('Shift swap request not found');
  return swap;
}
