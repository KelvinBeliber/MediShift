import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { EventClickArg, EventContentArg } from '@fullcalendar/core'
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PaperAirplaneIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  CheckBadgeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/16/solid'
import {
  Panel,
  PANEL_PADDING,
  PanelLabel,
  SectionHeading,
} from '@/components/dashboard-primitives/Panel'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePermission } from '@/features/auth/usePermission'
import { schedulesApi, shiftsApi } from '@/features/schedules/api'
import { shiftTypeStyle } from '@/features/schedules/shiftStyle'
import type { GenerationResult, Shift } from '@/features/schedules/types'
import { SHIFT_TYPES, type ShiftType } from '@/features/departments/types'
import { certificationsApi } from '@/features/certifications/api'
import { employeesApi } from '@/features/employees/api'
import { toApiError } from '@/lib/api/errors'
import { cn } from '@/lib/utils'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const EDITABLE_STATUSES = new Set(['draft', 'generated'])
const ASSIGNMENT_STATUSES = ['assigned', 'confirmed', 'declined', 'completed', 'no_show'] as const

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function toDateInput(iso: string): string {
  return iso.slice(0, 10)
}

/** `declined`/`no_show` are the states most important to catch at a glance,
 * so they carry the most attention-grabbing glyphs. */
const ASSIGNMENT_STATUS_ICON: Record<string, typeof CheckCircleIcon> = {
  assigned: UserPlusIcon,
  confirmed: CheckCircleIcon,
  declined: XCircleIcon,
  completed: CheckBadgeIcon,
  no_show: ExclamationTriangleIcon,
}

/** OPTIMAL/FEASIBLE/INFEASIBLE, coloured per what it means for the manager. */
function GenerationStatusBadge({ status }: { status: string }) {
  if (status === 'OPTIMAL') {
    return (
      <Badge className="gap-1 bg-brand-teal/15 text-brand-teal-deep hover:bg-brand-teal/15">
        <CheckCircleIcon className="size-3.5" /> Optimal
      </Badge>
    )
  }
  if (status === 'FEASIBLE') {
    return (
      <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
        <ExclamationTriangleIcon className="size-3.5" /> Feasible, not optimal
      </Badge>
    )
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircleIcon className="size-3.5" /> {status}
    </Badge>
  )
}

/**
 * Persistent result of the last AI generate call — not a toast, because the
 * unfilled-shift list is actionable and worth keeping on screen. "Dismiss"
 * collapses it to a one-line summary rather than removing it, so navigating
 * back to this shift a minute later doesn't mean re-running Generate just to
 * see whether anything was left unfilled. It only fully resets on a new
 * generate call (see the `result` dependency below) or leaving the page —
 * there's no backend field that would let it survive a reload.
 */
function GenerationPanel({
  result,
  shifts,
  onOpenShift,
}: {
  result: GenerationResult
  shifts: Shift[]
  onOpenShift: (shiftId: string) => void
}) {
  const shiftById = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts])
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => setCollapsed(false), [result])

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="mb-5 flex w-full items-center gap-2.5 rounded-lg border bg-card px-4 py-2.5 text-left text-sm hover:bg-secondary/40"
      >
        <GenerationStatusBadge status={result.status} />
        <span className="text-muted-foreground">
          {result.unfilledShifts.length > 0
            ? `${result.unfilledShifts.length} unfilled shift${result.unfilledShifts.length === 1 ? '' : 's'}`
            : 'All shifts fully staffed'}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">Click to expand</span>
      </button>
    )
  }

  return (
    <Panel elevation="focal" className={cn(PANEL_PADDING, 'mb-5')} role="status">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <GenerationStatusBadge status={result.status} />
          <span className="text-sm text-muted-foreground">{result.message}</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse"
        >
          <XMarkIcon className="size-4" />
        </Button>
      </div>

      {result.stats && (
        <div className="mt-4 grid grid-cols-3 gap-4 sm:max-w-md">
          <div>
            <PanelLabel>Coverage</PanelLabel>
            <p className="mt-1 text-lg font-bold tabular-nums">{result.stats.coveragePercent}%</p>
          </div>
          <div>
            <PanelLabel>Assigned</PanelLabel>
            <p className="mt-1 text-lg font-bold tabular-nums">
              {result.stats.totalAssignments}/{result.stats.totalShifts}
            </p>
          </div>
          <div>
            <PanelLabel>Solve time</PanelLabel>
            <p className="mt-1 text-lg font-bold tabular-nums">
              {result.stats.solveTimeSeconds?.toFixed(1)}s
            </p>
          </div>
        </div>
      )}

      {result.unfilledShifts.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <PanelLabel>Unfilled shifts ({result.unfilledShifts.length})</PanelLabel>
          <ul className="mt-2 space-y-1.5">
            {result.unfilledShifts.map((u) => {
              const shift = shiftById.get(u.shiftId)
              return (
                <li key={u.shiftId}>
                  <button
                    type="button"
                    onClick={() => onOpenShift(u.shiftId)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary/60"
                  >
                    <span>
                      {shift
                        ? new Date(shift.date).toLocaleDateString(undefined, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })
                        : '—'}
                      {shift && (
                        <span className="ml-2 capitalize text-muted-foreground">
                          {shift.shiftType}
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-destructive tabular-nums">
                      {u.assignedCount}/{u.requiredStaff} · short {u.shortBy}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Panel>
  )
}

const shiftFormSchema = z.object({
  date: z.string().min(1, 'Required'),
  shiftType: z.enum(SHIFT_TYPES),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Required'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Required'),
  requiredStaff: z.string().trim().min(1, 'Required'),
  notes: z.string().trim().optional(),
})
type ShiftFormValues = z.infer<typeof shiftFormSchema>

type DialogState =
  { mode: 'create'; defaultDate?: string } | { mode: 'edit'; shiftId: string } | null

function ShiftDialog({
  state,
  onOpenChange,
  scheduleId,
  departmentId,
  shift,
  canEdit,
  editable,
}: {
  state: DialogState
  onOpenChange: (open: boolean) => void
  scheduleId: string
  departmentId: string
  shift: Shift | undefined
  canEdit: boolean
  editable: boolean
}) {
  const queryClient = useQueryClient()
  const [requiredCertifications, setRequiredCertifications] = useState<string[]>([])
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  // Staffing an existing shift is the more common day-to-day action than
  // re-checking its definition, so an existing shift opens straight to it;
  // a brand-new shift has no assignments yet, so it skips tabs entirely.
  const [activeTab, setActiveTab] = useState<'details' | 'assign'>('assign')
  const editShiftId = state?.mode === 'edit' ? state.shiftId : null
  useEffect(() => {
    if (editShiftId) setActiveTab('assign')
  }, [editShiftId])

  const { data: certData } = useQuery({
    queryKey: ['certifications'],
    queryFn: () => certificationsApi.list(),
  })
  const { data: employeeData } = useQuery({
    queryKey: ['employees', 'for-assignment', departmentId],
    queryFn: () => employeesApi.list({ department: departmentId, status: 'active', limit: 100 }),
    enabled: Boolean(state),
  })

  const certifications = certData?.items ?? []
  const employees = employeeData?.items ?? []

  const isEdit = state?.mode === 'edit'
  const open = Boolean(state)

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
    values: shift
      ? {
          date: toDateInput(shift.date),
          shiftType: shift.shiftType,
          startTime: shift.startTime,
          endTime: shift.endTime,
          requiredStaff: String(shift.requiredStaff),
          notes: shift.notes ?? '',
        }
      : {
          date: state?.mode === 'create' ? (state.defaultDate ?? '') : '',
          shiftType: 'morning' as ShiftType,
          startTime: '07:00',
          endTime: '15:00',
          requiredStaff: '1',
          notes: '',
        },
  })

  // requiredCertifications lives outside react-hook-form, same pattern as the
  // department staffing-requirement editor — a badge multi-toggle isn't a
  // single form field worth validating.
  const [editedCerts, setEditedCerts] = useState<string[] | null>(null)
  const certsForShift = editedCerts ?? shift?.requiredCertifications ?? requiredCertifications

  function toggleCert(id: string) {
    const base = shift ? certsForShift : requiredCertifications
    const next = base.includes(id) ? base.filter((c) => c !== id) : [...base, id]
    if (shift) setEditedCerts(next)
    else setRequiredCertifications(next)
  }

  function invalidateSchedule() {
    void queryClient.invalidateQueries({ queryKey: ['schedules', scheduleId] })
  }

  const createShift = useMutation({
    mutationFn: (values: ShiftFormValues) =>
      shiftsApi.create({
        ...values,
        requiredStaff: Number(values.requiredStaff),
        schedule: scheduleId,
        requiredCertifications,
      }),
    onSuccess: () => {
      toast.success('Shift created')
      invalidateSchedule()
      onOpenChange(false)
      setRequiredCertifications([])
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const updateShift = useMutation({
    mutationFn: (values: ShiftFormValues) =>
      shiftsApi.update(shift!.id, {
        ...values,
        requiredStaff: Number(values.requiredStaff),
        requiredCertifications: editedCerts ?? undefined,
      }),
    onSuccess: () => {
      toast.success('Shift updated')
      invalidateSchedule()
      setEditedCerts(null)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const deleteShift = useMutation({
    mutationFn: () => shiftsApi.remove(shift!.id),
    onSuccess: () => {
      toast.success('Shift deleted')
      invalidateSchedule()
      onOpenChange(false)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const assign = useMutation({
    mutationFn: (employeeId: string) => shiftsApi.assign(shift!.id, employeeId),
    onSuccess: () => {
      toast.success('Employee assigned')
      invalidateSchedule()
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const updateAssignment = useMutation({
    mutationFn: ({
      assignmentId,
      status,
    }: {
      assignmentId: string
      status: (typeof ASSIGNMENT_STATUSES)[number]
    }) => shiftsApi.updateAssignment(shift!.id, assignmentId, status),
    onSuccess: () => {
      invalidateSchedule()
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const removeAssignment = useMutation({
    mutationFn: (assignmentId: string) => shiftsApi.removeAssignment(shift!.id, assignmentId),
    onSuccess: () => {
      toast.success('Assignment removed')
      invalidateSchedule()
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const activeAssignments = (shift?.assignments ?? []).filter((a) => a.status !== 'declined')
  const assignedEmployeeIds = new Set(
    activeAssignments.map((a) => (typeof a.employee === 'string' ? a.employee : a.employee.id)),
  )
  const assignableEmployees = employees.filter((e) => !assignedEmployeeIds.has(e.id))
  const isFull = shift ? activeAssignments.length >= shift.requiredStaff : false

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setRequiredCertifications([])
            setEditedCerts(null)
            setConfirmDeleteOpen(false)
          }
          onOpenChange(next)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Shift' : 'New shift'}</DialogTitle>
          </DialogHeader>

          {isEdit && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'details' | 'assign')}>
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="assign">Assign staff</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {(!isEdit || activeTab === 'details') && (
            <Form {...form}>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit((values) =>
                  isEdit ? updateShift.mutate(values) : createShift.mutate(values),
                )}
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" disabled={!editable} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shiftType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={!editable}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SHIFT_TYPES.map((t) => (
                              <SelectItem key={t} value={t} className="capitalize">
                                {t.replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start</FormLabel>
                        <FormControl>
                          <Input {...field} type="time" disabled={!editable} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End</FormLabel>
                        <FormControl>
                          <Input {...field} type="time" disabled={!editable} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requiredStaff"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Required staff</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min={0} disabled={!editable} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-sm font-medium">Required certifications</p>
                  <div className="flex flex-wrap gap-1.5">
                    {certifications.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No certifications configured yet.
                      </p>
                    )}
                    {certifications.map((cert) => {
                      const active = certsForShift.includes(cert.id)
                      return (
                        <button
                          key={cert.id}
                          type="button"
                          disabled={!editable}
                          onClick={() => toggleCert(cert.id)}
                        >
                          <Badge
                            variant={active ? 'default' : 'outline'}
                            className="cursor-pointer text-xs"
                          >
                            {cert.name}
                          </Badge>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} disabled={!editable} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {editable && (
                  <DialogFooter className="items-center sm:justify-between">
                    {isEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteOpen(true)}
                        disabled={deleteShift.isPending}
                      >
                        <TrashIcon /> Delete shift
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Button type="submit" disabled={createShift.isPending || updateShift.isPending}>
                      {createShift.isPending || updateShift.isPending
                        ? 'Saving…'
                        : isEdit
                          ? 'Save changes'
                          : 'Create shift'}
                    </Button>
                  </DialogFooter>
                )}
              </form>
            </Form>
          )}

          {isEdit && shift && activeTab === 'assign' && (
            <div className="pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Assignments{' '}
                  <span className="text-muted-foreground tabular-nums">
                    ({activeAssignments.length}/{shift.requiredStaff})
                  </span>
                </p>
                {isFull && (
                  <Badge variant="secondary" className="text-xs">
                    Fully staffed
                  </Badge>
                )}
              </div>

              {(shift.assignments ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No one assigned to this shift yet.
                </p>
              ) : (
                <ul className="mt-2">
                  {(shift.assignments ?? []).map((a, i) => {
                    const name =
                      typeof a.employee === 'string'
                        ? a.employee
                        : `${a.employee.firstName} ${a.employee.lastName}`
                    return (
                      <li key={a.id}>
                        {i > 0 && <Separator />}
                        <div className="flex items-center gap-2 py-2">
                          <Avatar size="sm">
                            <AvatarFallback>{initials(name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate text-sm">
                              {name}
                              {a.isAiGenerated && (
                                <SparklesIcon
                                  className="size-3 shrink-0 text-brand-teal-deep"
                                  aria-label="AI-assigned"
                                />
                              )}
                            </p>
                          </div>
                          {canEdit && editable ? (
                            <>
                              <Select
                                value={a.status}
                                onValueChange={(v) =>
                                  updateAssignment.mutate({
                                    assignmentId: a.id,
                                    status: v as (typeof ASSIGNMENT_STATUSES)[number],
                                  })
                                }
                              >
                                <SelectTrigger size="sm" className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ASSIGNMENT_STATUSES.map((s) => (
                                    <SelectItem key={s} value={s} className="text-xs capitalize">
                                      {s.replace('_', ' ')}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => removeAssignment.mutate(a.id)}
                                aria-label="Remove assignment"
                              >
                                <XMarkIcon className="size-4" />
                              </Button>
                            </>
                          ) : (
                            <Badge variant="outline" className="text-xs capitalize">
                              {(() => {
                                const Icon = ASSIGNMENT_STATUS_ICON[a.status]
                                return Icon ? <Icon className="size-3" aria-hidden="true" /> : null
                              })()}
                              {a.status.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              {canEdit && editable && !isFull && (
                <div className="mt-3">
                  <Select onValueChange={(v) => assign.mutate(v)} disabled={assign.isPending}>
                    <SelectTrigger className="w-full">
                      <UserPlusIcon className="size-4 text-muted-foreground" />
                      <SelectValue placeholder="Assign an employee…" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableEmployees.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No unassigned active employees in this department.
                        </div>
                      )}
                      {assignableEmployees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.firstName} {e.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Certification match, double-booking and staffing caps are checked on the server.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete shift?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes this shift and any assignments on it. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteShift.mutate()}
              disabled={deleteShift.isPending}
            >
              {deleteShift.isPending ? 'Deleting…' : 'Delete shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Previews what "Generate shifts" would create — from the department's staffing
 * requirements — before anything is written, then lets the manager confirm.
 * Re-running it later (e.g. after widening the date range or editing staffing
 * requirements) only proposes what's still missing; it never touches or
 * duplicates shifts that already exist.
 */
function GenerateShiftsDialog({
  open,
  onOpenChange,
  scheduleId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
}) {
  const queryClient = useQueryClient()

  const {
    data: summary,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['schedules', scheduleId, 'shifts', 'preview'],
    queryFn: () => schedulesApi.previewShifts(scheduleId),
    enabled: open,
  })

  const generate = useMutation({
    mutationFn: () => schedulesApi.generateShifts(scheduleId),
    onSuccess: ({ created }) => {
      void queryClient.invalidateQueries({ queryKey: ['schedules', scheduleId] })
      if (created.length > 0) {
        toast.success(`${created.length} shift${created.length === 1 ? '' : 's'} created`)
      } else {
        toast('Nothing to generate — shifts already match the staffing requirements')
      }
      onOpenChange(false)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const hasProposals = (summary?.proposedShiftCount ?? 0) > 0

  return (
    <Dialog open={open} onOpenChange={(next) => !generate.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate shifts</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive">Couldn't load a preview — try again.</p>
        )}

        {summary && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Based on this department's staffing requirements, applied across{' '}
              {new Date(summary.dateRange.startDate).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
              })}
              {' – '}
              {new Date(summary.dateRange.endDate).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              .
            </p>

            {hasProposals ? (
              <>
                <div className="grid grid-cols-2 gap-4 rounded-lg border bg-secondary/30 p-4 sm:max-w-xs">
                  <div>
                    <PanelLabel>New shifts</PanelLabel>
                    <p className="mt-1 text-lg font-bold tabular-nums">{summary.proposedShiftCount}</p>
                  </div>
                  <div>
                    <PanelLabel>Staff slots</PanelLabel>
                    <p className="mt-1 text-lg font-bold tabular-nums">{summary.totalStaffSlots}</p>
                  </div>
                </div>

                <ul className="divide-y rounded-lg border">
                  {summary.proposedByType.map((t) => {
                    const style = shiftTypeStyle(t.shiftType)
                    return (
                      <li
                        key={t.shiftType}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <span className={cn('size-1.5 rounded-full', style.dot)} />
                          <span className="capitalize">{t.shiftType.replace('_', ' ')}</span>
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {t.count} shift{t.count === 1 ? '' : 's'} · {t.totalStaffSlots} staff
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : (
              <p className="rounded-lg border bg-secondary/30 p-4 text-sm text-muted-foreground">
                {summary.hasStaffingRequirements
                  ? 'Nothing new to generate — shifts already exist for every day this covers.'
                  : "This department has no staffing requirements that auto-generate shifts yet. Add them on the department page, or create shifts manually."}
              </p>
            )}

            {summary.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-400">
                  <ExclamationTriangleIcon className="size-4" /> Needs manual shifts
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-amber-700 dark:text-amber-400/90">
                  {summary.warnings.map((w) => (
                    <li key={w.shiftType}>{w.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generate.isPending}>
            Cancel
          </Button>
          <Button onClick={() => generate.mutate()} disabled={!hasProposals || generate.isPending}>
            {generate.isPending
              ? 'Generating…'
              : hasProposals
                ? `Generate ${summary?.proposedShiftCount} shift${summary?.proposedShiftCount === 1 ? '' : 's'}`
                : 'Generate shifts'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Screen 14 — `/schedules/:id`. The flagship screen: FullCalendar + the AI generate flow. */
export function ScheduleDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const calendarRef = useRef<FullCalendar>(null)
  const [calendarTitle, setCalendarTitle] = useState('')

  const canEdit = usePermission('schedule:edit')
  const canGenerate = usePermission('schedule:generate')
  const canPublish = usePermission('schedule:publish')
  const canDelete = usePermission('schedule:delete')

  const [dialogState, setDialogState] = useState<DialogState>(null)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [publishConfirm, setPublishConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [generateShiftsOpen, setGenerateShiftsOpen] = useState(false)

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['schedules', id],
    queryFn: () => schedulesApi.get(id),
    enabled: Boolean(id),
  })

  const shifts = useMemo(() => schedule?.shifts ?? [], [schedule])
  const activeShift =
    dialogState?.mode === 'edit' ? shifts.find((s) => s.id === dialogState.shiftId) : undefined

  const generate = useMutation({
    mutationFn: () => schedulesApi.generate(id),
    onSuccess: ({ generation }) => {
      setGenerationResult(generation)
      void queryClient.invalidateQueries({ queryKey: ['schedules', id] })
      if (generation.status === 'INFEASIBLE') toast.error(generation.message)
      else toast.success(generation.message)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const publish = useMutation({
    mutationFn: () => schedulesApi.publish(id),
    onSuccess: () => {
      toast.success('Schedule published — the department has been notified')
      void queryClient.invalidateQueries({ queryKey: ['schedules', id] })
      setPublishConfirm(false)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  const removeSchedule = useMutation({
    mutationFn: () => schedulesApi.remove(id),
    onSuccess: () => {
      toast.success('Draft schedule deleted')
      void navigate('/schedules')
    },
    onError: (error) => toast.error(toApiError(error).message),
  })

  if (isLoading || !schedule) {
    return (
      <div>
        <Skeleton className="mb-4 h-8 w-40" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const departmentId =
    typeof schedule.department === 'string' ? schedule.department : schedule.department.id
  const departmentName =
    typeof schedule.department === 'string' ? schedule.department : schedule.department.name
  const editable = EDITABLE_STATUSES.has(schedule.status)
  const isGenerating = generate.isPending || schedule.status === 'generating'

  const events = shifts.map((shift) => ({
    id: shift.id,
    start: shift.date.slice(0, 10),
    allDay: true,
    extendedProps: { shift },
  }))

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Schedules', to: '/schedules' },
          { label: `${departmentName} · ${MONTHS[schedule.month - 1]} ${schedule.year}` },
        ]}
      />
      <Button
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        onClick={() => void navigate('/schedules')}
      >
        <ArrowLeftIcon /> Schedules
      </Button>

      <SectionHeading
        description={
          schedule.notes ||
          `${MONTHS[schedule.month - 1]} ${schedule.year}, published to the whole department once it goes live.`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Low-risk, frequent actions on the left. */}
            <div className="flex items-center gap-2">
              {canEdit && editable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogState({ mode: 'create' })}
                >
                  <PlusIcon /> Add shift
                </Button>
              )}
              {canGenerate && editable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGenerateShiftsOpen(true)}
                >
                  <CalendarDaysIcon /> Generate shifts
                </Button>
              )}
              {canGenerate && editable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generate.mutate()}
                  disabled={isGenerating}
                >
                  <SparklesIcon /> {isGenerating ? 'Generating…' : 'AI Generate'}
                </Button>
              )}
            </div>

            {/* The schedule's actual goal-state transition (primary) and the
                one genuinely destructive action (small, last) — kept visually
                apart so they never read as equally weighted. */}
            {((canPublish && editable && shifts.length > 0) ||
              (canDelete && schedule.status === 'draft')) && (
              <div className="ml-auto flex items-center gap-2 border-l pl-2">
                {canPublish && editable && shifts.length > 0 && (
                  <Button
                    size="sm"
                    onClick={() => setPublishConfirm(true)}
                    disabled={publish.isPending}
                  >
                    <PaperAirplaneIcon /> Publish
                  </Button>
                )}
                {canDelete && schedule.status === 'draft' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(true)}
                    disabled={removeSchedule.isPending}
                  >
                    <TrashIcon /> Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        }
      >
        <span className="flex items-center gap-2.5">
          {departmentName} · {MONTHS[schedule.month - 1]} {schedule.year}
          <Badge
            variant={schedule.status === 'published' ? 'default' : 'outline'}
            className="capitalize"
          >
            {schedule.status === 'published' && <CheckBadgeIcon aria-hidden="true" />}
            {schedule.status}
          </Badge>
        </span>
      </SectionHeading>

      <Dialog open={publishConfirm} onOpenChange={setPublishConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish schedule?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Publishing notifies every employee in <strong>{departmentName}</strong> and locks manual
            shift edits. This cannot be undone from here.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={() => publish.mutate()} disabled={publish.isPending}>
              {publish.isPending ? 'Publishing…' : 'Yes, publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete schedule?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes this draft schedule and all {shifts.length} shift
            {shifts.length === 1 ? '' : 's'} on it. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => removeSchedule.mutate()}
              disabled={removeSchedule.isPending}
            >
              {removeSchedule.isPending ? 'Deleting…' : 'Delete schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Panel className={cn(PANEL_PADDING, 'mb-5 flex items-center gap-2.5')}>
        {editable ? (
          <>
            <PlusIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm">
              <strong className="font-medium capitalize">{schedule.status}</strong> — shifts can be
              edited and generated.
            </p>
          </>
        ) : schedule.status === 'published' ? (
          <>
            <CheckBadgeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm">
              <strong className="font-medium">Published</strong>
              {schedule.publishedAt && ` ${new Date(schedule.publishedAt).toLocaleString()}`} —
              shift details are locked; assignment status can still change.
            </p>
          </>
        ) : (
          <>
            <ExclamationTriangleIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm">
              This schedule is <strong className="font-medium capitalize">{schedule.status}</strong>{' '}
              and can no longer be edited.
            </p>
          </>
        )}
      </Panel>

      {generationResult && (
        <GenerationPanel
          result={generationResult}
          shifts={shifts}
          onOpenShift={(shiftId) => setDialogState({ mode: 'edit', shiftId })}
        />
      )}

      <Panel className="p-0">
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => calendarRef.current?.getApi().prev()}
              aria-label="Previous month"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => calendarRef.current?.getApi().next()}
              aria-label="Next month"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => calendarRef.current?.getApi().today()}>
              Today
            </Button>
          </div>
          <p className="text-sm font-semibold">{calendarTitle}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-shift-morning" /> Morning
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-shift-afternoon" /> Afternoon
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-shift-night" /> Night
            </span>
          </div>
        </div>

        <div className="p-2">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={false}
            height="auto"
            firstDay={1}
            events={events}
            dayMaxEvents={4}
            datesSet={(arg) => setCalendarTitle(arg.view.title)}
            dateClick={(arg: DateClickArg) => {
              if (canEdit && editable) setDialogState({ mode: 'create', defaultDate: arg.dateStr })
            }}
            eventClick={(arg: EventClickArg) =>
              setDialogState({ mode: 'edit', shiftId: arg.event.id })
            }
            eventContent={(arg: EventContentArg) => {
              const shift = arg.event.extendedProps.shift as Shift
              const style = shiftTypeStyle(shift.shiftType)
              const assigned = (shift.assignments ?? []).filter(
                (a) => a.status !== 'declined',
              ).length
              const short = assigned < shift.requiredStaff
              return (
                <div
                  className={cn(
                    'flex items-center gap-1.5 overflow-hidden rounded-md px-1.5 py-1',
                    style.bg,
                  )}
                >
                  <span className={cn('size-1.5 shrink-0 rounded-full', style.dot)} />
                  <span className="shrink-0 text-[0.6875rem] font-semibold tabular-nums">
                    {shift.startTime}
                  </span>
                  <span className="truncate text-[0.6875rem] text-muted-foreground capitalize">
                    {shift.shiftType.replace('_', ' ')}
                  </span>
                  <span
                    className={cn(
                      'ml-auto shrink-0 text-[0.625rem] font-bold tabular-nums',
                      short ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {assigned}/{shift.requiredStaff}
                  </span>
                </div>
              )
            }}
          />
        </div>
      </Panel>

      <ShiftDialog
        state={dialogState}
        onOpenChange={(open) => !open && setDialogState(null)}
        scheduleId={id}
        departmentId={departmentId}
        shift={activeShift}
        canEdit={canEdit}
        editable={editable}
      />

      <GenerateShiftsDialog
        open={generateShiftsOpen}
        onOpenChange={setGenerateShiftsOpen}
        scheduleId={id}
      />
    </div>
  )
}
