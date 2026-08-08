import { getPaginated, post } from '@/lib/api/client'
import type { LeaveRequest, LeaveRequestInput } from './types'

export const leaveApi = {
  list: (filters: { status?: string; employee?: string; page?: number; limit?: number }) =>
    getPaginated<LeaveRequest>('/leave', { params: filters }),
  create: (data: LeaveRequestInput) => post<LeaveRequest>('/leave', data),
  cancel: (id: string) => post<LeaveRequest>(`/leave/${id}/cancel`),
  departmentApprove: (id: string, comment?: string) =>
    post<LeaveRequest>(`/leave/${id}/department-approve`, { comment }),
  hrApprove: (id: string, comment?: string) => post<LeaveRequest>(`/leave/${id}/hr-approve`, { comment }),
  reject: (id: string, rejectionReason: string) => post<LeaveRequest>(`/leave/${id}/reject`, { rejectionReason }),
}
