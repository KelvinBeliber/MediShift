import type { ComponentType, SVGProps } from 'react'
import {
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/16/solid'
import { Badge } from '@/components/ui/badge'
import type { ShiftSwapStatus } from './types'

const VARIANT: Record<ShiftSwapStatus, 'warning' | 'success' | 'destructive' | 'outline'> = {
  pending: 'warning',
  accepted: 'warning',
  manager_approved: 'success',
  rejected: 'destructive',
  cancelled: 'outline',
}

const LABEL: Record<ShiftSwapStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  manager_approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

/** Rejected/cancelled are the states most likely to be missed at a glance, so
 * they carry the most noticeable glyphs (warning triangle, X circle). */
const ICON: Record<ShiftSwapStatus, ComponentType<SVGProps<SVGSVGElement>>> = {
  pending: ClockIcon,
  accepted: CheckIcon,
  manager_approved: CheckCircleIcon,
  rejected: ExclamationTriangleIcon,
  cancelled: XCircleIcon,
}

export function ShiftSwapStatusBadge({ status }: { status: ShiftSwapStatus }) {
  const Icon = ICON[status]
  return (
    <Badge variant={VARIANT[status]}>
      <Icon aria-hidden="true" />
      {LABEL[status]}
    </Badge>
  )
}
