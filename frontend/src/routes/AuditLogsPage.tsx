import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { EyeIcon } from '@heroicons/react/24/outline'
import {
  CheckIcon,
  LockClosedIcon,
  MegaphoneIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/16/solid'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/data/EmptyState'
import { Pagination } from '@/components/data/Pagination'
import { Panel } from '@/components/dashboard-primitives/Panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { auditLogsApi } from '@/features/auditLogs/api'
import { AUDIT_ACTIONS, type AuditLogEntry } from '@/features/auditLogs/types'

const ACTION_VARIANT: Record<string, 'success' | 'secondary' | 'outline' | 'destructive'> = {
  CREATE: 'secondary',
  UPDATE: 'outline',
  DELETE: 'destructive',
  APPROVE: 'success',
  REJECT: 'destructive',
  PUBLISH: 'success',
  FINALIZE: 'success',
}

/** DELETE and REJECT are the most consequential actions to spot at a glance,
 * so they carry the most attention-grabbing glyphs. */
const ACTION_ICON: Record<string, typeof PlusIcon> = {
  CREATE: PlusIcon,
  UPDATE: PencilIcon,
  DELETE: TrashIcon,
  APPROVE: CheckIcon,
  REJECT: XMarkIcon,
  PUBLISH: MegaphoneIcon,
  FINALIZE: LockClosedIcon,
}

function userLabel(user: AuditLogEntry['user']): string {
  if (!user) return 'System'
  return typeof user === 'string' ? user : user.email
}

/** Screen 25 — `/audit-logs`. `audit_log:view`-gated (super_admin/hospital_admin) at the router. */
export function AuditLogsPage() {
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [inspecting, setInspecting] = useState<AuditLogEntry | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', { entityType, action, dateFrom, dateTo, page }],
    queryFn: () =>
      auditLogsApi.list({
        entityType: entityType || undefined,
        action: action || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: 25,
      }),
  })

  const entries = data?.items ?? []

  return (
    <div>
      <PageHeader
        title="Audit logs"
        description="A curated trail of sensitive actions — employee, department, leave, schedule, payroll and document changes. Not every action in the system is logged."
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1.5 block text-muted-foreground">Entity type</span>
          <Input
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            placeholder="e.g. Employee"
            className="w-40"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-muted-foreground">Action</span>
          <Select value={action || 'all'} onValueChange={(v) => setAction(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {AUDIT_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-muted-foreground">From</span>
          <DatePicker value={dateFrom} onChange={setDateFrom} />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-muted-foreground">To</span>
          <DatePicker value={dateTo} onChange={setDateTo} />
        </label>
      </div>

      {isLoading ? (
        <Panel className="p-6">
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Panel>
      ) : entries.length === 0 ? (
        <EmptyState title="No matching entries" description="Nothing logged for this filter yet." />
      ) : (
        <>
          <Panel className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm tabular-nums">{new Date(entry.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={ACTION_VARIANT[entry.action] ?? 'outline'}>
                        {(() => {
                          const Icon = ACTION_ICON[entry.action]
                          return Icon ? <Icon aria-hidden="true" /> : null
                        })()}
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.entityType}
                      {entry.entityId && (
                        <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                          {entry.entityId.slice(-8)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{userLabel(entry.user)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{entry.ipAddress ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => setInspecting(entry)} aria-label="View details">
                        <EyeIcon className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
          {data && <Pagination meta={data.pagination} onPageChange={setPage} />}
        </>
      )}

      <Dialog open={Boolean(inspecting)} onOpenChange={(open) => !open && setInspecting(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {inspecting?.action} · {inspecting?.entityType}
            </DialogTitle>
          </DialogHeader>
          {inspecting && (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-muted-foreground">
                <dt>When</dt>
                <dd className="text-foreground">{new Date(inspecting.createdAt).toLocaleString()}</dd>
                <dt>User</dt>
                <dd className="text-foreground">{userLabel(inspecting.user)}</dd>
                <dt>IP address</dt>
                <dd className="text-foreground">{inspecting.ipAddress ?? '—'}</dd>
                <dt>User agent</dt>
                <dd className="truncate text-foreground" title={inspecting.userAgent}>
                  {inspecting.userAgent ?? '—'}
                </dd>
              </dl>
              {inspecting.before !== undefined && (
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Before</p>
                  <pre className="max-h-48 overflow-auto rounded-md bg-secondary/50 p-3 font-mono text-xs">
                    {JSON.stringify(inspecting.before, null, 2)}
                  </pre>
                </div>
              )}
              {inspecting.after !== undefined && (
                <div>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">After</p>
                  <pre className="max-h-48 overflow-auto rounded-md bg-secondary/50 p-3 font-mono text-xs">
                    {JSON.stringify(inspecting.after, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
