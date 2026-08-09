import type { ComponentType, SVGProps } from 'react'
import { CheckCircleIcon, ExclamationTriangleIcon, SunIcon, XCircleIcon } from '@heroicons/react/16/solid'
import { Badge } from '@/components/ui/badge'
import type { Employee } from './types'

/** `terminated` is the state most important to catch at a glance, so it gets
 * the most attention-grabbing glyph. */
const VARIANT: Record<Employee['status'], 'success' | 'warning' | 'outline' | 'destructive'> = {
  active: 'success',
  on_leave: 'warning',
  inactive: 'outline',
  terminated: 'destructive',
}

const ICON: Record<Employee['status'], ComponentType<SVGProps<SVGSVGElement>>> = {
  active: CheckCircleIcon,
  on_leave: SunIcon,
  inactive: XCircleIcon,
  terminated: ExclamationTriangleIcon,
}

/**
 * Shared by the employee list and detail screens — the detail screen used to
 * render its own unstyled `<Badge>` with no variant, so `terminated` looked
 * identical to `active`. One source of truth for the colour now.
 */
export function EmployeeStatusBadge({ status }: { status: Employee['status'] }) {
  const Icon = ICON[status]
  return (
    <Badge variant={VARIANT[status] ?? 'outline'} className="capitalize">
      <Icon aria-hidden="true" />
      {status.replace('_', ' ')}
    </Badge>
  )
}
