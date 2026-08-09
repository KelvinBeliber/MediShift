import type { ComponentType, SVGProps } from 'react'
import { CheckCircleIcon, ClockIcon, DocumentIcon, MegaphoneIcon, PencilIcon } from '@heroicons/react/16/solid'
import { Badge } from '@/components/ui/badge'
import type { ScheduleStatus } from './types'

/**
 * `draft → generating → generated → published`, with `archived` as the exit.
 * Colour rises with the milestone: grey while nothing's committed yet, amber
 * while the solver is running, green once there's a result, and the bold
 * solid green reserved for `published` — the one state that's actually live
 * for staff, so it should outrank a merely-generated schedule at a glance.
 */
const VARIANT: Record<ScheduleStatus, 'outline' | 'warning' | 'success' | 'default'> = {
  draft: 'outline',
  generating: 'warning',
  generated: 'success',
  published: 'default',
  archived: 'outline',
}

/** `published` is the state most important to catch at a glance (it's live
 * for staff), so it gets the most attention-grabbing glyph. */
const ICON: Record<ScheduleStatus, ComponentType<SVGProps<SVGSVGElement>>> = {
  draft: PencilIcon,
  generating: ClockIcon,
  generated: CheckCircleIcon,
  published: MegaphoneIcon,
  archived: DocumentIcon,
}

export function ScheduleStatusBadge({ status }: { status: ScheduleStatus }) {
  const Icon = ICON[status]
  return (
    <Badge variant={VARIANT[status]} className="capitalize">
      <Icon aria-hidden="true" />
      {status}
    </Badge>
  )
}
