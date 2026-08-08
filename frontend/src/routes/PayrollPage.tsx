import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { z } from 'zod'
import { ArrowDownTrayIcon, LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon, DocumentTextIcon } from '@heroicons/react/16/solid'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/data/EmptyState'
import { Panel, PANEL_PADDING, PanelLabel } from '@/components/dashboard-primitives/Panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { usePermission } from '@/features/auth/usePermission'
import { departmentsApi } from '@/features/departments/api'
import { payrollApi } from '@/features/payroll/api'
import { PAYROLL_STATUSES, type PayrollInput, type PayrollStatus } from '@/features/payroll/types'
import { toApiError } from '@/lib/api/errors'
import { staggerContainer } from '@/lib/motion'

const STATUS_VARIANT: Record<PayrollStatus, 'outline' | 'secondary' | 'default'> = {
  draft: 'outline',
  finalized: 'secondary',
  exported: 'default',
}

const STATUS_ICON: Record<PayrollStatus, typeof CheckCircleIcon> = {
  draft: DocumentTextIcon,
  finalized: CheckCircleIcon,
  exported: ArrowDownTrayIcon,
}

function firstOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const generateSchema = z
  .object({
    periodStart: z.string().min(1, 'Required'),
    periodEnd: z.string().min(1, 'Required'),
    department: z.string().optional(),
  })
  .refine((d) => d.periodEnd >= d.periodStart, { message: 'Must be on or after the start date', path: ['periodEnd'] })
type GenerateValues = z.infer<typeof generateSchema>

function employeeName(employee: PayrollInput['employee']): string {
  return typeof employee === 'string' ? employee : `${employee.firstName} ${employee.lastName}`
}

/** Screen 21 — `/payroll`. */
export function PayrollPage() {
  const canManage = usePermission('payroll:manage')
  const canView = usePermission('payroll:view')
  const queryClient = useQueryClient()

  const [periodStart, setPeriodStart] = useState(firstOfMonth())
  const [periodEnd, setPeriodEnd] = useState(today())
  const [status, setStatus] = useState('')
  const [generateOpen, setGenerateOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['payroll', { periodStart, periodEnd, status }],
    queryFn: () => payrollApi.list({ periodStart, periodEnd, status: status || undefined, limit: 100 }),
    enabled: canView,
  })
  const { data: departments } = useQuery({
    queryKey: ['departments', 'for-payroll'],
    queryFn: () => departmentsApi.list(),
    enabled: canManage,
  })

  const form = useForm<GenerateValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: { periodStart: firstOfMonth(), periodEnd: today(), department: '' },
  })

  const generate = useMutation({
    mutationFn: (values: GenerateValues) =>
      payrollApi.generate({ ...values, department: values.department || undefined }),
    onSuccess: (results) => {
      toast.success(`Generated payroll input for ${results.length} employee(s)`)
      void queryClient.invalidateQueries({ queryKey: ['payroll'] })
      setGenerateOpen(false)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const finalize = useMutation({
    mutationFn: (id: string) => payrollApi.finalize(id),
    onSuccess: () => {
      toast.success('Payroll input finalized')
      void queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  async function handleExport() {
    setExporting(true)
    try {
      await payrollApi.exportCsv(periodStart, periodEnd)
    } catch (error) {
      toast.error(toApiError(error).message)
    } finally {
      setExporting(false)
    }
  }

  const rows = data?.items ?? []
  const totals = rows.reduce(
    (acc, r) => ({
      hours: acc.hours + r.totalHoursWorked,
      overtime: acc.overtime + r.overtimeHours,
      absences: acc.absences + r.absences,
    }),
    { hours: 0, overtime: 0, absences: 0 },
  )

  if (!canView) {
    return (
      <EmptyState title="Payroll" description="You don't have permission to view payroll records." />
    )
  }

  return (
    <div>
      <PageHeader
        title="Payroll"
        description="Hours, overtime and tardiness computed from attendance — CSV export only, no Excel/PDF yet."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void handleExport()} disabled={exporting}>
              <ArrowDownTrayIcon /> {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            {canManage && (
              <Button onClick={() => setGenerateOpen(true)}>
                <SparklesIcon /> Generate
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1.5 block text-muted-foreground">Period start</span>
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-muted-foreground">Period end</span>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-muted-foreground">Status</span>
          <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {PAYROLL_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {rows.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-4 sm:max-w-md">
          <Panel className={PANEL_PADDING}>
            <PanelLabel>Records</PanelLabel>
            <p className="mt-1 text-xl font-bold tabular-nums">{rows.length}</p>
          </Panel>
          <Panel className={PANEL_PADDING}>
            <PanelLabel>Total hours</PanelLabel>
            <p className="mt-1 text-xl font-bold tabular-nums">{totals.hours.toFixed(1)}</p>
          </Panel>
          <Panel className={PANEL_PADDING}>
            <PanelLabel>Overtime</PanelLabel>
            <p className="mt-1 text-xl font-bold tabular-nums">{totals.overtime.toFixed(1)}</p>
          </Panel>
        </div>
      )}

      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        {isLoading ? (
          <Panel className={PANEL_PADDING}>
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </Panel>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No payroll records for this period"
            description={canManage ? 'Generate payroll inputs from attendance for this date range.' : 'Nothing generated yet.'}
          />
        ) : (
          <Panel className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Overtime</TableHead>
                  <TableHead>Night diff.</TableHead>
                  <TableHead>Tardiness</TableHead>
                  <TableHead>Absences</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{employeeName(r.employee)}</TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="tabular-nums">{r.totalHoursWorked}</TableCell>
                    <TableCell className="tabular-nums">{r.overtimeHours}</TableCell>
                    <TableCell className="tabular-nums">{r.nightDifferentialHours}</TableCell>
                    <TableCell className="tabular-nums">{r.tardinessMinutes}m</TableCell>
                    <TableCell className="tabular-nums">{r.absences}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">
                        {(() => {
                          const Icon = STATUS_ICON[r.status]
                          return <Icon aria-hidden="true" />
                        })()}
                        {r.status}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {r.status === 'draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => finalize.mutate(r.id)}
                            disabled={finalize.isPending}
                          >
                            <LockClosedIcon /> Finalize
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </motion.div>

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate payroll</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => generate.mutate(values))}>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="periodStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period start</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="periodEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period end</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department (optional)</FormLabel>
                    <Select value={field.value || 'all'} onValueChange={(v) => field.onChange(v === 'all' ? '' : v)}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Every department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">Every department</SelectItem>
                        {(departments?.items ?? []).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="rounded-md bg-secondary/40 p-3 text-xs text-muted-foreground">
                Computes hours, overtime, night differential, tardiness, undertime and absences from attendance
                records for every active employee in range.
              </p>
              <DialogFooter>
                <Button type="submit" disabled={generate.isPending}>
                  {generate.isPending ? 'Generating…' : 'Generate'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
