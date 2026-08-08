import { del, getPaginated, post, put } from '@/lib/api/client'
import type { Certification, CertificationInput } from './types'

export const certificationsApi = {
  list: () => getPaginated<Certification>('/certifications', { params: { limit: 100 } }),
  create: (data: CertificationInput) => post<Certification>('/certifications', data),
  update: (id: string, data: Partial<CertificationInput>) => put<Certification>(`/certifications/${id}`, data),
  deactivate: (id: string) => del<Certification>(`/certifications/${id}`),
}
