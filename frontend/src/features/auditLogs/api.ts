import { getPaginated } from '@/lib/api/client'
import type { AuditLogEntry, AuditLogFilters } from './types'

export const auditLogsApi = {
  list: (filters: AuditLogFilters) => getPaginated<AuditLogEntry>('/audit-logs', { params: filters }),
}
