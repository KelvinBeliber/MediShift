import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { CheckIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import {
  CalendarDaysIcon as CalendarDaysIconOutline,
  CheckBadgeIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/data/EmptyState'
import { Stepper, type StepperStep } from '@/components/data/Stepper'
import { LeaveStatusBadge } from '@/features/leave/LeaveStatusBadge'
import { HrApproveWarningDialog } from '@/features/leave/HrApproveWarningDialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { usePermission } from '@/features/auth/usePermission'
import { leaveApi } from '@/features/leave/api'
import { LEAVE_TYPES, type LeaveRequest } from '@/features/leave/types'
import { employeesApi } from '@/features/employees/api'
import { toApiError } from '@/lib/api/errors'
import { initials } from '@/lib/utils'

const requestSchema = z
  .object({
    employeeId: z.string().optional(),
    leaveType: z.enum(LEAVE_TYPES),
    startDate: z.string().min(1, 'Required'),
    endDate: z.string().min(1, 'Required'),
    reason: z.string().trim().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, { message: 'Must be on or after start date', path: ['endDate'] })

type RequestValues = z.infer<typeof requestSchema>

/** Non-terminal statuses progress linearly through this 3-stage machine; `rejected`/`cancelled` are exits, not a fourth stage, so they get the badge only. */
const LEAVE_STEPS: StepperStep[] = [
  { key: 'pending', label: 'Requested', icon: ClockIcon },
  { key: 'department_approved', label: 'Dept. approved', icon: CalendarDaysIconOutline },
  { key: 'approved', label: 'HR approved', icon: CheckBadgeIcon },
]

function leaveStepIndex(status: LeaveRequest['status']): number | null {
  if (status === 'pending') return 0
  if (status === 'department_approved') return 1
  if (status === 'approved') return 2
  return null
}

/** Screen 16 — `/leave`. */
export function LeavePage() {
  const queryClient = useQueryClient()
  const canApprove = usePermission('leave:approve')
  const [requestOpen, setRequestOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [hrApproveTarget, setHrApproveTarget] = useState<LeaveRequest | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['leave', { statusFilter }],
    queryFn: () => leaveApi.list({ status: statusFilter || undefined, limit: 50 }),
  })
  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'for-leave'],
    queryFn: () => employeesApi.list({ limit: 100 }),
    enabled: canApprove && requestOpen,
  })

  const form = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { employeeId: '', leaveType: 'vacation', startDate: '', endDate: '', reason: '' },
  })

  const submit = useMutation({
    mutationFn: (values: RequestValues) =>
      leaveApi.create({
        employeeId: values.employeeId || undefined,
        leaveType: values.leaveType,
        startDate: values.startDate,
        endDate: values.endDate,
        reason: values.reason || undefined,
      }),
    onSuccess: () => {
      toast.success('Leave request submitted')
      void queryClient.invalidateQueries({ queryKey: ['leave'] })
      setRequestOpen(false)
      form.reset()
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['leave'] })
  }

  const cancel = useMutation({
    mutationFn: (id: string) => leaveApi.cancel(id),
    onSuccess: () => {
      toast.success('Request cancelled')
      invalidate()
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const deptApprove = useMutation({
    mutationFn: (id: string) => leaveApi.departmentApprove(id),
    onSuccess: () => {
      toast.success('Department-approved')
      invalidate()
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const hrApprove = useMutation({
    mutationFn: (id: string) => leaveApi.hrApprove(id),
    onSuccess: () => {
      toast.success('HR-approved — overlapping shift assignments have been declined automatically')
      invalidate()
      setHrApproveTarget(null)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => leaveApi.reject(id, reason),
    onSuccess: () => {
      toast.success('Request rejected')
      invalidate()
      setRejectTarget(null)
      setRejectReason('')
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const requests = data?.items ?? []

  return (
    <div>
      <PageHeader
        title="Leave requests"
        description={
          canApprove
            ? 'Everyone in the organization — department approval, then HR approval.'
            : 'Your leave requests and their approval status.'
        }
        actions={
          <Button onClick={() => setRequestOpen(true)}>
            <PlusIcon /> Request leave
          </Button>
        }
      />

      {canApprove && (
        <div className="mb-4">
          <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="department_approved">Department-approved</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {!isLoading && requests.length === 0 && (
        <EmptyState title="No leave requests" description="Nothing here yet." />
      )}

      {requests.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              {canApprove && <TableHead>Employee</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((req) => (
              <TableRow key={req.id}>
                {canApprove && (
                  <TableCell>
                    {(() => {
                      const name =
                        typeof req.employee === 'string'
                          ? req.employee
                          : `${req.employee.firstName} ${req.employee.lastName}`
                      return (
                        <div className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback>{initials(name)}</AvatarFallback>
                          </Avatar>
                          {name}
                        </div>
                      )
                    })()}
                  </TableCell>
                )}
                <TableCell className="capitalize">{req.leaveType}</TableCell>
                <TableCell>
                  {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                </TableCell>
                <TableCell>{req.totalDays}</TableCell>
                <TableCell>
                  {leaveStepIndex(req.status) !== null ? (
                    <div className="flex items-center gap-2">
                      <Stepper steps={LEAVE_STEPS} activeIndex={leaveStepIndex(req.status)!} compact />
                      <LeaveStatusBadge status={req.status} />
                    </div>
                  ) : (
                    <LeaveStatusBadge status={req.status} />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {req.status === 'pending' && (
                      <Button variant="outline" size="sm" onClick={() => cancel.mutate(req.id)} disabled={cancel.isPending}>
                        Cancel
                      </Button>
                    )}
                    {canApprove && req.status === 'pending' && (
                      <Button size="sm" onClick={() => deptApprove.mutate(req.id)} disabled={deptApprove.isPending}>
                        <CheckIcon /> Dept. approve
                      </Button>
                    )}
                    {canApprove && req.status === 'department_approved' && (
                      <Button size="sm" onClick={() => setHrApproveTarget(req)}>
                        <CheckIcon /> HR approve
                      </Button>
                    )}
                    {canApprove && (req.status === 'pending' || req.status === 'department_approved') && (
                      <Button variant="destructive" size="sm" onClick={() => setRejectTarget(req)}>
                        <XMarkIcon /> Reject
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request leave</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => submit.mutate(values))}>
              {canApprove && (
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>On behalf of</FormLabel>
                      <Select value={field.value || 'self'} onValueChange={(v) => field.onChange(v === 'self' ? '' : v)}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Myself" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="self">Myself</SelectItem>
                          {(employeesData?.items ?? []).map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.firstName} {emp.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="leaveType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LEAVE_TYPES.map((type) => (
                          <SelectItem key={type} value={type} className="capitalize">
                            {type}
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
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start date</FormLabel>
                      <FormControl>
                        <DatePicker {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End date</FormLabel>
                      <FormControl>
                        <DatePicker {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={submit.isPending}>
                  {submit.isPending ? 'Submitting…' : 'Submit'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject leave request</DialogTitle>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection"
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || reject.isPending}
              onClick={() => rejectTarget && reject.mutate({ id: rejectTarget.id, reason: rejectReason })}
            >
              {reject.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HrApproveWarningDialog
        request={hrApproveTarget}
        onOpenChange={(open) => !open && setHrApproveTarget(null)}
        onConfirm={() => hrApproveTarget && hrApprove.mutate(hrApproveTarget.id)}
        isPending={hrApprove.isPending}
      />
    </div>
  )
}
