import { api, getPaginated, post, put } from '@/lib/api/client'
import type { GeneratePayrollInput, PayrollFilters, PayrollInput } from './types'

export const payrollApi = {
  list: (filters: PayrollFilters) => getPaginated<PayrollInput>('/payroll', { params: filters }),
  generate: (data: GeneratePayrollInput) => post<PayrollInput[]>('/payroll/generate', data),
  finalize: (id: string) => put<PayrollInput>(`/payroll/${id}/finalize`),

  /** CSV download — the only export format the API has (see docs/API_REFERENCE.md §15). */
  exportCsv: async (periodStart: string, periodEnd: string): Promise<void> => {
    const response = await api.get('/payroll/export', {
      params: { periodStart, periodEnd },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `payroll_${periodStart}_${periodEnd}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  },
}
