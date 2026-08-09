import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { initials } from '@/lib/utils'

interface EmployeeAvatarProps {
  name: string
  photo?: string
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

/**
 * The name-plus-avatar pairing repeated across every list, table, and picker
 * that mentions an employee. Several of those call sites only have a
 * lightweight ref (`EmployeeRef`/`SwapEmployeeRef`/`DepartmentEmployeeRef`)
 * with no `photo` field — `photo` is optional here so those render as
 * initials-only, same as the full-`Employee` sites render a real picture.
 */
export function EmployeeAvatar({ name, photo, size = 'sm', className }: EmployeeAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {photo && <AvatarImage src={photo} alt="" />}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
