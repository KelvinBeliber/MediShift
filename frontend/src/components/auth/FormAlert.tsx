import { ExclamationCircleIcon, InformationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

const TONES = {
  error: {
    icon: ExclamationCircleIcon,
    className: 'bg-destructive/8 text-destructive',
  },
  success: {
    icon: CheckCircleIcon,
    className: 'bg-primary/8 text-primary',
  },
  info: {
    icon: InformationCircleIcon,
    className: 'bg-brand-mist-50 text-brand-slate',
  },
} as const

interface FormAlertProps {
  tone?: keyof typeof TONES
  children: React.ReactNode
  className?: string
}

/**
 * Form-level messaging — the things that belong to the submission rather than
 * to one field. Tinted ground and a matching icon, never a coloured left bar.
 */
export function FormAlert({ tone = 'error', children, className }: FormAlertProps) {
  const { icon: Icon, className: toneClass } = TONES[tone]

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-md px-3.5 py-3 text-sm leading-relaxed',
        toneClass,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
