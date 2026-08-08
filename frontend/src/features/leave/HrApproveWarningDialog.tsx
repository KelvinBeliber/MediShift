import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { shiftsApi } from '@/features/schedules/api'
import type { Shift } from '@/features/schedules/types'
import type { LeaveRequest } from './types'

function heldBy(shift: Shift, employeeId: string): boolean {
  return (shift.assignments ?? []).some((a) => {
    if (a.status !== 'assigned' && a.status !== 'confirmed') return false
    const id = typeof a.employee === 'string' ? a.employee : a.employee.id
    return id === employeeId
  })
}

/**
 * HR-approving leave automatically declines any overlapping shift
 * assignments — a real side effect the approver should see before
 * confirming, not just find out about afterward. No dedicated backend
 * endpoint exists for this preview, so it's derived the same way
 * ShiftSwapsPage already looks up an employee's shifts: fetch shifts in the
 * date window and filter client-side to that employee's active assignments.
 */
export function HrApproveWarningDialog({
  request,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  request: LeaveRequest | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isPending: boolean
}) {
  const open = Boolean(request)
  const employeeId = request
    ? typeof request.employee === 'string'
      ? request.employee
      : request.employee.id
    : ''

  const { data, isLoading } = useQuery({
    queryKey: ['shifts', 'hr-approve-check', request?.id],
    queryFn: () =>
      shiftsApi.list({
        dateFrom: request!.startDate.slice(0, 10),
        dateTo: request!.endDate.slice(0, 10),
        limit: 100,
      }),
    enabled: open,
  })

  const affectedShifts = useMemo(
    () => (data?.items ?? []).filter((shift) => heldBy(shift, employeeId)),
    [data, employeeId],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve leave — HR</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Checking scheduled shifts…</p>
        ) : affectedShifts.length > 0 ? (
          <div className="space-y-2">
            <p className="flex items-start gap-1.5 text-sm text-amber-700">
              <ExclamationTriangleIcon className="size-4 shrink-0 translate-y-0.5" aria-hidden="true" />
              Approving will automatically decline {affectedShifts.length} scheduled shift
              {affectedShifts.length === 1 ? '' : 's'} for this employee:
            </p>
            <ul className="divide-y rounded-md border text-sm">
              {affectedShifts.map((shift) => (
                <li key={shift.id} className="flex items-center justify-between px-3 py-2">
                  <span>
                    {new Date(shift.date).toLocaleDateString()} · <span className="capitalize">{shift.shiftType}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {shift.startTime}–{shift.endTime}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No scheduled shifts will be affected.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending || isLoading}>
            {isPending ? 'Approving…' : 'Confirm HR approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
