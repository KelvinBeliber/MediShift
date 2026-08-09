import type { ComponentType, SVGProps } from 'react'
import {
  CheckBadgeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserPlusIcon,
  XCircleIcon,
} from '@heroicons/react/16/solid'
import { Badge } from '@/components/ui/badge'
import type { ShiftAssignmentStatus } from './types'

const VARIANT: Record<ShiftAssignmentStatus, 'outline' | 'success' | 'destructive'> = {
  assigned: 'outline',
  confirmed: 'success',
  declined: 'destructive',
  completed: 'success',
  no_show: 'destructive',
}

/** `declined`/`no_show` are the states most important to catch at a glance,
 * so they carry the most attention-grabbing glyphs. */
const ICON: Record<ShiftAssignmentStatus, ComponentType<SVGProps<SVGSVGElement>>> = {
  assigned: UserPlusIcon,
  confirmed: CheckCircleIcon,
  declined: XCircleIcon,
  completed: CheckBadgeIcon,
  no_show: ExclamationTriangleIcon,
}

export function ShiftAssignmentStatusBadge({ status }: { status: ShiftAssignmentStatus }) {
  const Icon = ICON[status]
  return (
    <Badge variant={VARIANT[status]} className="text-xs capitalize">
      <Icon className="size-3" aria-hidden="true" />
      {status.replace('_', ' ')}
    </Badge>
  )
}
