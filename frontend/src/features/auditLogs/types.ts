export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'PUBLISH', 'FINALIZE'] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export interface AuditLogEntry {
  id: string
  user?: { id: string; email: string } | string
  action: AuditAction
  entityType: string
  entityId?: string
  before?: unknown
  after?: unknown
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export interface AuditLogFilters {
  entityType?: string
  entityId?: string
  user?: string
  action?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}
