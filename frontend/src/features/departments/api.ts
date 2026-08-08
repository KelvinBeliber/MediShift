import { del, get, getPaginated, post, put } from '@/lib/api/client'
import type { Department, DepartmentInput, DepartmentStats } from './types'

export const departmentsApi = {
  list: () => getPaginated<Department>('/departments', { params: { limit: 100 } }),
  get: (id: string) => get<Department>(`/departments/${id}`),
  stats: (id: string) => get<DepartmentStats>(`/departments/${id}/stats`),
  create: (data: DepartmentInput) => post<Department>('/departments', data),
  update: (id: string, data: Partial<DepartmentInput>) => put<Department>(`/departments/${id}`, data),
  deactivate: (id: string) => del<Department>(`/departments/${id}`),
  assignManager: (id: string, employeeId: string) =>
    post<Department>(`/departments/${id}/manager`, { employeeId }),
  assignEmployees: (id: string, employeeIds: string[]) =>
    post<{ modifiedCount: number }>(`/departments/${id}/employees`, { employeeIds }),
}
