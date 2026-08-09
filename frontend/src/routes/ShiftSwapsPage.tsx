import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { z } from 'zod'
import { ArrowsRightLeftIcon, CheckBadgeIcon, ClockIcon, GiftIcon, HandRaisedIcon, PlusIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/data/EmptyState'
import { Stepper, type StepperStep } from '@/components/data/Stepper'
import { Panel } from '@/components/dashboard-primitives/Panel'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useCurrentUser, usePermission } from '@/features/auth/usePermission'
import { employeesApi } from '@/features/employees/api'
import { shiftsApi } from '@/features/schedules/api'
import type { Shift } from '@/features/schedules/types'
import { shiftSwapsApi } from '@/features/shiftSwaps/api'
import { ShiftSwapStatusBadge } from '@/features/shiftSwaps/ShiftSwapStatusBadge'
import type { ShiftSwapRequest } from '@/features/shiftSwaps/types'
import { toApiError } from '@/lib/api/errors'
import { staggerContainer } from '@/lib/motion'
import { initials } from '@/lib/utils'

function shiftLabel(shift: ShiftSwapRequest['requestingShift']): string {
  if (typeof shift === 'string') return shift
  const date = new Date(shift.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  return `${date} · ${shift.shiftType.replace('_', ' ')} · ${shift.startTime}–${shift.endTime}`
}

function employeeLabel(employee: ShiftSwapRequest['requestingEmployee'] | undefined): string {
  if (!employee) return '—'
  if (typeof employee === 'string') return employee
  return `${employee.firstName} ${employee.lastName}`
}

function EmployeeCell({ employee }: { employee: ShiftSwapRequest['requestingEmployee'] | undefined }) {
  const name = employeeLabel(employee)
  if (name === '—') return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex items-center gap-2">
      <Avatar size="sm">
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      {name}
    </div>
  )
}

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** `rejected`/`cancelled` are exits from this 3-stage machine, not a fourth stage — badge only for those. */
const SWAP_STEPS: StepperStep[] = [
  { key: 'pending', label: 'Requested', icon: ClockIcon },
  { key: 'accepted', label: 'Accepted', icon: HandRaisedIcon },
  { key: 'manager_approved', label: 'Approved', icon: CheckBadgeIcon },
]

function swapStepIndex(status: ShiftSwapRequest['status']): number | null {
  if (status === 'pending') return 0
  if (status === 'accepted') return 1
  if (status === 'manager_approved') return 2
  return null
}

const createSchema = z
  .object({
    requestingShift: z.string().min(1, 'Select one of your shifts'),
    swapType: z.enum(['give_away', 'trade']),
    targetEmployee: z.string().optional(),
    targetShift: z.string().optional(),
    reason: z.string().trim().optional(),
  })
  .refine((d) => d.swapType !== 'trade' || Boolean(d.targetEmployee), {
    message: 'Required for a direct trade',
    path: ['targetEmployee'],
  })
  .refine((d) => d.swapType !== 'trade' || Boolean(d.targetShift), {
    message: 'Required for a direct trade',
    path: ['targetShift'],
  })
type CreateValues = z.infer<typeof createSchema>

function RequestSwapDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const myEmployeeId = user?.employee?.id

  const { data: shiftData } = useQuery({
    queryKey: ['shifts', 'for-swap-request'],
    queryFn: () => shiftsApi.list({ dateFrom: isoDate(0), dateTo: isoDate(45), limit: 200 }),
    enabled: open,
  })
  const { data: employeeData } = useQuery({
    queryKey: ['employees', 'for-swap-request'],
    queryFn: () => employeesApi.list({ status: 'active', limit: 100 }),
    enabled: open,
  })

  const allShifts = useMemo(() => shiftData?.items ?? [], [shiftData])
  const employees = (employeeData?.items ?? []).filter((e) => e.id !== myEmployeeId)

  function heldBy(shift: Shift, employeeId: string): boolean {
    return (shift.assignments ?? []).some((a) => {
      if (a.status !== 'assigned' && a.status !== 'confirmed') return false
      const id = typeof a.employee === 'string' ? a.employee : a.employee.id
      return id === employeeId
    })
  }

  const myShifts = useMemo(
    () => (myEmployeeId ? allShifts.filter((s) => heldBy(s, myEmployeeId)) : []),
    [allShifts, myEmployeeId],
  )

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { requestingShift: '', swapType: 'give_away', targetEmployee: '', targetShift: '', reason: '' },
  })

  const targetEmployeeId = form.watch('targetEmployee')
  const targetShifts = useMemo(
    () => (targetEmployeeId ? allShifts.filter((s) => heldBy(s, targetEmployeeId)) : []),
    [allShifts, targetEmployeeId],
  )

  const create = useMutation({
    mutationFn: (values: CreateValues) =>
      shiftSwapsApi.create({
        requestingShift: values.requestingShift,
        targetEmployee: values.targetEmployee || undefined,
        targetShift: values.swapType === 'trade' ? values.targetShift : undefined,
        reason: values.reason || undefined,
      }),
    onSuccess: () => {
      toast.success('Swap request created')
      void queryClient.invalidateQueries({ queryKey: ['shift-swaps'] })
      onOpenChange(false)
      form.reset()
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a shift swap</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
            <FormField
              control={form.control}
              name="requestingShift"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your shift</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={myShifts.length === 0 ? 'No upcoming shifts found' : 'Select a shift'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {myShifts.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {shiftLabel(s)}
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
              name="swapType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Swap type</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => field.onChange('give_away')}
                      className={
                        'flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors ' +
                        (field.value === 'give_away' ? 'border-primary bg-primary/5' : 'hover:bg-secondary/50')
                      }
                    >
                      <GiftIcon className="size-4 text-brand-teal-deep" />
                      <span>
                        <span className="block font-medium">Give away</span>
                        <span className="block text-xs text-muted-foreground">Anyone can claim it</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange('trade')}
                      className={
                        'flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors ' +
                        (field.value === 'trade' ? 'border-primary bg-primary/5' : 'hover:bg-secondary/50')
                      }
                    >
                      <ArrowsRightLeftIcon className="size-4 text-brand-teal-deep" />
                      <span>
                        <span className="block font-medium">Direct trade</span>
                        <span className="block text-xs text-muted-foreground">Swap for their shift</span>
                      </span>
                    </button>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetEmployee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {form.watch('swapType') === 'trade' ? 'Trade with' : 'Offer to (optional)'}
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Anyone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.firstName} {e.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('swapType') === 'trade' && (
              <FormField
                control={form.control}
                name="targetShift"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Their shift</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={!targetEmployeeId}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              !targetEmployeeId
                                ? 'Choose who first'
                                : targetShifts.length === 0
                                  ? 'No upcoming shifts for this person'
                                  : 'Select their shift'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {targetShifts.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {shiftLabel(s)}
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
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Submitting…' : 'Submit request'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function RejectDialog({
  swap,
  onOpenChange,
}: {
  swap: ShiftSwapRequest | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')

  const reject = useMutation({
    mutationFn: (id: string) => shiftSwapsApi.reject(id, reason),
    onSuccess: () => {
      toast.success('Swap rejected')
      void queryClient.invalidateQueries({ queryKey: ['shift-swaps'] })
      onOpenChange(false)
      setReason('')
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  return (
    <Dialog open={Boolean(swap)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject shift swap</DialogTitle>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection" rows={3} />
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={!reason.trim() || reject.isPending}
            onClick={() => swap && reject.mutate(swap.id)}
          >
            {reject.isPending ? 'Rejecting…' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Screen 17 — `/shift-swaps`. */
export function ShiftSwapsPage() {
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const myEmployeeId = user?.employee?.id
  const canApprove = usePermission('shift_swap:approve')

  const [status, setStatus] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<ShiftSwapRequest | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['shift-swaps', { status }],
    queryFn: () => shiftSwapsApi.list({ status: status || undefined, limit: 50 }),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['shift-swaps'] })
  }

  const accept = useMutation({
    mutationFn: (id: string) => shiftSwapsApi.accept(id),
    onSuccess: () => {
      toast.success('Swap accepted — waiting on manager approval')
      invalidate()
    },
    onError: (error) => toast.error(toApiError(error).message),
  })
  const approve = useMutation({
    mutationFn: (id: string) => shiftSwapsApi.approve(id),
    onSuccess: () => {
      toast.success('Swap approved and the schedule has been updated')
      invalidate()
    },
    onError: (error) => toast.error(toApiError(error).message),
  })
  const cancel = useMutation({
    mutationFn: (id: string) => shiftSwapsApi.cancel(id),
    onSuccess: () => {
      toast.success('Request cancelled')
      invalidate()
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const swaps = data?.items ?? []

  function idOf(ref: ShiftSwapRequest['requestingEmployee'] | undefined): string | undefined {
    if (!ref) return undefined
    return typeof ref === 'string' ? ref : ref.id
  }

  return (
    <div>
      <PageHeader
        title="Shift swaps"
        description="Give away a shift, or trade directly with a colleague."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon /> Request swap
          </Button>
        }
      />

      <div className="mb-5">
        <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="manager_approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        {isLoading ? (
          <Panel className="p-6">
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </Panel>
        ) : swaps.length === 0 ? (
          <EmptyState
            title="No shift swaps"
            description="Requests you're involved in — as the requester or the target — appear here."
          />
        ) : (
          <Panel className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {swaps.map((swap) => {
                  const isRequester = idOf(swap.requestingEmployee) === myEmployeeId
                  const isTarget = idOf(swap.targetEmployee) === myEmployeeId
                  const canAccept =
                    swap.status === 'pending' && !isRequester && (!swap.targetEmployee || isTarget)

                  return (
                    <TableRow key={swap.id}>
                      <TableCell>
                        <EmployeeCell employee={swap.requestingEmployee} />
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{shiftLabel(swap.requestingShift)}</TableCell>
                      <TableCell>
                        {swap.targetEmployee ? (
                          <EmployeeCell employee={swap.targetEmployee} />
                        ) : (
                          <span className="text-muted-foreground">Open</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1 text-xs">
                          {swap.targetShift ? <ArrowsRightLeftIcon className="size-3" /> : <GiftIcon className="size-3" />}
                          {swap.targetShift ? 'Trade' : 'Give away'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {swapStepIndex(swap.status) !== null ? (
                          <div className="flex items-center gap-2">
                            <Stepper steps={SWAP_STEPS} activeIndex={swapStepIndex(swap.status)!} compact />
                            <ShiftSwapStatusBadge status={swap.status} />
                          </div>
                        ) : (
                          <ShiftSwapStatusBadge status={swap.status} />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {canAccept && (
                            <Button size="sm" onClick={() => accept.mutate(swap.id)} disabled={accept.isPending}>
                              Accept
                            </Button>
                          )}
                          {isRequester && swap.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancel.mutate(swap.id)}
                              disabled={cancel.isPending}
                            >
                              Cancel
                            </Button>
                          )}
                          {canApprove && swap.status === 'accepted' && (
                            <Button size="sm" onClick={() => approve.mutate(swap.id)} disabled={approve.isPending}>
                              Approve
                            </Button>
                          )}
                          {canApprove && (swap.status === 'pending' || swap.status === 'accepted') && (
                            <Button variant="destructive" size="sm" onClick={() => setRejectTarget(swap)}>
                              Reject
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Panel>
        )}
      </motion.div>

      <RequestSwapDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RejectDialog swap={rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)} />
    </div>
  )
}
