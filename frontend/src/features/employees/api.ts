import { del, get, getPaginated, post, put } from '@/lib/api/client'
import { api } from '@/lib/api/client'
import type { Paginated } from '@/lib/api/types'
import type { Employee, EmployeeDocument, EmployeeInput, EmployeeListFilters, UpdateOwnProfileInput } from './types'

export const employeesApi = {
  list: (filters: EmployeeListFilters) =>
    getPaginated<Employee>('/employees', { params: filters }),

  get: (id: string) => get<Employee>(`/employees/${id}`),

  me: () => get<Employee>('/employees/me'),

  updateMe: (data: UpdateOwnProfileInput) => put<Employee>('/employees/me', data),

  create: (data: EmployeeInput) => post<Employee>('/employees', data),

  update: (id: string, data: Partial<EmployeeInput>) => put<Employee>(`/employees/${id}`, data),

  deactivate: (id: string) => del<Employee>(`/employees/${id}`),

  documents: (id: string) => get<EmployeeDocument[]>(`/employees/${id}/documents`),

  uploadDocument: async (id: string, file: File, type: string): Promise<EmployeeDocument> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    const response = await api.post(`/employees/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data.data
  },

  deleteDocument: (documentId: string) => del<null>(`/documents/${documentId}`),
}

export type { Paginated }
