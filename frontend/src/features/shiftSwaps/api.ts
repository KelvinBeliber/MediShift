import { getPaginated, post } from '@/lib/api/client'
import type { CreateSwapInput, ShiftSwapFilters, ShiftSwapRequest } from './types'

export const shiftSwapsApi = {
  list: (filters: ShiftSwapFilters) => getPaginated<ShiftSwapRequest>('/shift-swaps', { params: filters }),
  create: (data: CreateSwapInput) => post<ShiftSwapRequest>('/shift-swaps', data),
  accept: (id: string) => post<ShiftSwapRequest>(`/shift-swaps/${id}/accept`),
  approve: (id: string) => post<ShiftSwapRequest>(`/shift-swaps/${id}/approve`),
  reject: (id: string, rejectionReason: string) =>
    post<ShiftSwapRequest>(`/shift-swaps/${id}/reject`, { rejectionReason }),
  cancel: (id: string) => post<ShiftSwapRequest>(`/shift-swaps/${id}/cancel`),
}
