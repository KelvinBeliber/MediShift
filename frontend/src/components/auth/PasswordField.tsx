import { useState } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type PasswordFieldProps = Omit<React.ComponentProps<'input'>, 'type'>

/**
 * A password input with a reveal toggle and a caps-lock warning.
 *
 * Caps lock is worth the ~15 lines: the API returns the same "Invalid email or
 * password" for a wrong password as for an unknown account, so a user who
 * mistypes because caps lock is on gets no clue from the server. Telling them
 * before they submit is the only place that can be caught.
 */
export function PasswordField({ className, ...props }: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  const trackCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState?.('CapsLock') ?? false)
  }

  return (
    <div>
      <div className="relative">
        <Input
          {...props}
          type={revealed ? 'text' : 'password'}
          className={cn('pr-11', className)}
          onKeyUp={trackCapsLock}
          onKeyDown={trackCapsLock}
          onBlur={(event) => {
            setCapsLock(false)
            props.onBlur?.(event)
          }}
        />
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          // Toggling reveal is not a form step; keep it out of the tab order so
          // Tab always goes from the password straight to the submit button.
          tabIndex={-1}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {revealed ? <EyeSlashIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>

      {capsLock && (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          Caps lock is on.
        </p>
      )}
    </div>
  )
}
