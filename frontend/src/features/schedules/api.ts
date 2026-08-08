import { del, get, getPaginated, post, put } from '@/lib/api/client'
import type {
  CreateScheduleInput,
  GenerationResult,
  Schedule,
  ScheduleListFilters,
  Shift,
  ShiftAssignment,
  ShiftGenerationSummary,
  ShiftInput,
  ShiftListFilters,
} from './types'

export const schedulesApi = {
  list: (filters: ScheduleListFilters) => getPaginated<Schedule>('/schedules', { params: filters }),
  get: (id: string) => get<Schedule>(`/schedules/${id}`),
  create: (data: CreateScheduleInput) => post<Schedule>('/schedules', data),
  updateNotes: (id: string, notes: string) => put<Schedule>(`/schedules/${id}`, { notes }),
  remove: (id: string) => del<null>(`/schedules/${id}`),
  publish: (id: string) => post<Schedule>(`/schedules/${id}/publish`),
  generate: (id: string) => post<{ schedule: Schedule; generation: GenerationResult }>(`/schedules/${id}/generate`),
  previewShifts: (id: string) => post<ShiftGenerationSummary>(`/schedules/${id}/shifts/preview`),
  generateShifts: (id: string) =>
    post<{ created: Shift[]; summary: ShiftGenerationSummary }>(`/schedules/${id}/shifts/generate`),
}

export const shiftsApi = {
  list: (filters: ShiftListFilters) => getPaginated<Shift>('/shifts', { params: filters }),
  get: (id: string) => get<Shift>(`/shifts/${id}`),
  create: (data: ShiftInput) => post<Shift>('/shifts', data),
  update: (id: string, data: Partial<ShiftInput>) => put<Shift>(`/shifts/${id}`, data),
  remove: (id: string) => del<null>(`/shifts/${id}`),
  assign: (shiftId: string, employeeId: string, notes?: string) =>
    post<ShiftAssignment>(`/shifts/${shiftId}/assignments`, { employeeId, notes }),
  updateAssignment: (shiftId: string, assignmentId: string, status: ShiftAssignment['status'], notes?: string) =>
    put<ShiftAssignment>(`/shifts/${shiftId}/assignments/${assignmentId}`, { status, notes }),
  removeAssignment: (shiftId: string, assignmentId: string) =>
    del<null>(`/shifts/${shiftId}/assignments/${assignmentId}`),
}
