import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { z } from 'zod'
import { CalendarDaysIcon, PlusIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/data/EmptyState'
import { Panel, PANEL_PADDING } from '@/components/dashboard-primitives/Panel'
import { DepartmentBadge } from '@/components/data/DepartmentBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { usePermission } from '@/features/auth/usePermission'
import { departmentsApi } from '@/features/departments/api'
import { schedulesApi } from '@/features/schedules/api'
import { SCHEDULE_STATUSES } from '@/features/schedules/types'
import { ScheduleStatusBadge } from '@/features/schedules/ScheduleStatusBadge'
import { toApiError } from '@/lib/api/errors'
import { staggerContainer } from '@/lib/motion'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const createSchema = z.object({
  department: z.string().min(1, 'Required'),
  month: z.string().min(1, 'Required'),
  year: z.string().trim().min(1, 'Required'),
  notes: z.string().trim().optional(),
})
type CreateValues = z.infer<typeof createSchema>

/** Screen 13 — `/schedules`. */
export function SchedulesListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canCreate = usePermission('schedule:create')

  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [createOpen, setCreateOpen] = useState(false)

  const { data: departments } = useQuery({
    queryKey: ['departments', 'for-schedules'],
    queryFn: () => departmentsApi.list(),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['schedules', { department, status, year }],
    queryFn: () =>
      schedulesApi.list({
        department: department || undefined,
        status: status || undefined,
        year: year ? Number(year) : undefined,
        limit: 50,
      }),
  })

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      department: '',
      month: String(new Date().getMonth() + 1),
      year: String(new Date().getFullYear()),
      notes: '',
    },
  })

  const create = useMutation({
    mutationFn: (values: CreateValues) =>
      schedulesApi.create({ ...values, month: Number(values.month), year: Number(values.year) }),
    onSuccess: (schedule) => {
      toast.success('Draft schedule created')
      void queryClient.invalidateQueries({ queryKey: ['schedules'] })
      setCreateOpen(false)
      form.reset()
      void navigate(`/schedules/${schedule.id}`)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const schedules = data?.items ?? []
  const departmentOptions = departments?.items ?? []

  return (
    <div>
      <PageHeader
        title="Schedules"
        description="Monthly, per-department rosters — draft, AI-generate, then publish."
        actions={
          canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon /> New schedule
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1.5 block text-muted-foreground">Department</span>
          <Select value={department || 'all'} onValueChange={(v) => setDepartment(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departmentOptions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-muted-foreground">Status</span>
          <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {SCHEDULE_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-muted-foreground">Year</span>
          <Input type="number" className="w-28" value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        {isLoading ? (
          <Panel className={PANEL_PADDING}>
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </Panel>
        ) : schedules.length === 0 ? (
          <EmptyState
            title="No schedules yet"
            description={
              canCreate
                ? 'Create a draft schedule for a department and month, then use AI Generate to fill it.'
                : 'Nothing scheduled for this filter yet.'
            }
          />
        ) : (
          <Panel className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Shifts</TableHead>
                  <TableHead>Published</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow
                    key={schedule.id}
                    className="cursor-pointer"
                    onClick={() => void navigate(`/schedules/${schedule.id}`)}
                  >
                    <TableCell className="font-medium">
                      {typeof schedule.department === 'string' ? (
                        schedule.department
                      ) : (
                        <DepartmentBadge id={schedule.department.id} name={schedule.department.name} />
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {MONTHS[schedule.month - 1]} {schedule.year}
                    </TableCell>
                    <TableCell>
                      <ScheduleStatusBadge status={schedule.status} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {schedule.stats?.coveragePercent !== undefined
                        ? `${schedule.stats.coveragePercent}%`
                        : '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">{schedule.stats?.totalShifts ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {schedule.publishedAt ? new Date(schedule.publishedAt).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </motion.div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDaysIcon className="size-4.5 text-brand-teal-deep" /> New schedule
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departmentOptions.map((d) => (
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Month</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MONTHS.map((label, i) => (
                            <SelectItem key={label} value={String(i + 1)}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. coverage during renovation" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="flex items-start gap-2 rounded-md bg-secondary/40 p-3 text-xs text-muted-foreground">
                <SparklesIcon className="mt-0.5 size-3.5 shrink-0 text-brand-teal-deep" aria-hidden="true" />
                This creates an empty draft. Open it next to AI-generate shifts from the department's staffing
                requirements.
              </p>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? 'Creating…' : 'Create draft'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
