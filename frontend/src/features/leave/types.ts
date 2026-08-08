export const LEAVE_TYPES = [
  'vacation',
  'sick',
  'emergency',
  'maternity',
  'paternity',
  'bereavement',
  'study',
] as const

export type LeaveType = (typeof LEAVE_TYPES)[number]
export type LeaveStatus = 'pending' | 'department_approved' | 'approved' | 'rejected' | 'cancelled'

export interface LeaveRequest {
  id: string
  employee: { id: string; firstName: string; lastName: string; employeeId: string } | string
  leaveType: LeaveType
  startDate: string
  endDate: string
  totalDays: number
  reason?: string
  status: LeaveStatus
  departmentApproval?: { approvedBy?: string; approvedAt?: string; comment?: string }
  hrApproval?: { approvedBy?: string; approvedAt?: string; comment?: string }
  rejectionReason?: string
  createdAt: string
}

export interface LeaveRequestInput {
  employeeId?: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  reason?: string
}
