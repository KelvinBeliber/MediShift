export const SHIFT_SWAP_STATUSES = ['pending', 'accepted', 'manager_approved', 'rejected', 'cancelled'] as const
export type ShiftSwapStatus = (typeof SHIFT_SWAP_STATUSES)[number]

export interface SwapEmployeeRef {
  id: string
  firstName: string
  lastName: string
  employeeId: string
}

/** `requestingShift`/`targetShift` populate the full Shift document. */
export interface SwapShiftRef {
  id: string
  date: string
  shiftType: string
  startTime: string
  endTime: string
}

export interface ShiftSwapRequest {
  id: string
  requestingEmployee: SwapEmployeeRef | string
  requestingShift: SwapShiftRef | string
  targetEmployee?: SwapEmployeeRef | string
  targetShift?: SwapShiftRef | string
  status: ShiftSwapStatus
  reason?: string
  rejectionReason?: string
  acceptedAt?: string
  approvedAt?: string
  createdAt?: string
}

export interface CreateSwapInput {
  requestingEmployeeId?: string
  requestingShift: string
  targetEmployee?: string
  targetShift?: string
  reason?: string
}

export interface ShiftSwapFilters {
  employee?: string
  status?: string
  page?: number
  limit?: number
}
