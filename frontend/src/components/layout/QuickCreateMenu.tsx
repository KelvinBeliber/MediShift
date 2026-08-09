import { PlusIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PermissionKey } from '@/features/auth/permissions'

interface QuickCreateAction {
  to: string
  label: string
  permission: PermissionKey
}

const ACTIONS: QuickCreateAction[] = [
  { to: '/employees', label: 'Add employee', permission: 'employee:create' },
  { to: '/departments', label: 'Add department', permission: 'department:manage' },
  { to: '/positions', label: 'Add position', permission: 'position:manage' },
  { to: '/certifications', label: 'Add certification', permission: 'certification:manage' },
  { to: '/leave', label: 'Request leave', permission: 'leave:request' },
]

interface QuickCreateMenuProps {
  held: Set<string>
}

/**
 * Links rather than dialogs — each destination owns its own create flow, so
 * this jumps the user there rather than duplicating form state in the shell.
 */
export function QuickCreateMenu({ held }: QuickCreateMenuProps) {
  const navigate = useNavigate()
  const actions = ACTIONS.filter((action) => held.has(action.permission))

  if (actions.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* The one primary-styled button in the shell chrome — bright green on
            the dark bar reads as the header's single call to action. */}
        <Button size="sm" className="gap-1.5">
          <PlusIcon className="size-4" />
          <span className="hidden sm:inline">New</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem key={action.to} onSelect={() => void navigate(action.to)}>
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
