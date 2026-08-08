import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SubmitButtonProps extends React.ComponentProps<'button'> {
  pending: boolean
  /** Shown while pending. Use the present participle: "Signing in…". */
  pendingLabel: string
}

/**
 * The primary action of a form. Keeps its width while pending so the layout
 * does not jump, and names what it is doing rather than showing a bare spinner.
 */
export function SubmitButton({
  pending,
  pendingLabel,
  children,
  className,
  disabled,
  ...props
}: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      size="lg"
      className={cn('w-full', className)}
      disabled={pending || disabled}
      aria-busy={pending}
      {...props}
    >
      {pending && <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </Button>
  )
}
