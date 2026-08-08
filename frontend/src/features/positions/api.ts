import { del, getPaginated, post, put } from '@/lib/api/client'
import type { Position, PositionInput } from './types'

export const positionsApi = {
  list: () => getPaginated<Position>('/positions', { params: { limit: 100 } }),
  create: (data: PositionInput) => post<Position>('/positions', data),
  update: (id: string, data: Partial<PositionInput>) => put<Position>(`/positions/${id}`, data),
  deactivate: (id: string) => del<Position>(`/positions/${id}`),
}
