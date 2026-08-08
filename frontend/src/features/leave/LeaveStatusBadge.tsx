import type { ComponentType, SVGProps } from 'react'
import {
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/16/solid'
import { Badge } from '@/components/ui/badge'
import type { LeaveStatus } from './types'

/**
 * A leave request's position in the two-stage approval machine.
 *
 * `pending → department_approved → approved`, with `rejected`/`cancelled` as
 * exits. The intermediate stage is shown as itself rather than folded into
 * "pending", because it is what decides which action is available next: HR
 * approval is rejected with a 409 until department approval has happened.
 *
 * Lives in `features/leave` rather than the dashboard because screen 16 renders
 * the same states over the full list.
 */
const VARIANT: Record<LeaveStatus, 'secondary' | 'outline' | 'destructive'> = {
  pending: 'outline',
  department_approved: 'secondary',
  approved: 'secondary',
  rejected: 'destructive',
  cancelled: 'outline',
}

/** Rejected is the state most likely to be missed at a glance, so it carries
 * the most noticeable glyph (warning triangle). */
const ICON: Record<LeaveStatus, ComponentType<SVGProps<SVGSVGElement>>> = {
  pending: ClockIcon,
  department_approved: CheckIcon,
  approved: CheckCircleIcon,
  rejected: ExclamationTriangleIcon,
  cancelled: XCircleIcon,
}

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const Icon = ICON[status] ?? ClockIcon
  return (
    <Badge variant={VARIANT[status] ?? 'outline'} className="capitalize">
      <Icon aria-hidden="true" />
      {status.replace('_', ' ')}
    </Badge>
  )
}
