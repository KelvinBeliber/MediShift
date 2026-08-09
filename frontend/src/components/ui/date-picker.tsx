import * as React from "react"
import { format, isValid, parse } from "date-fns"
import { CalendarIcon, XMarkIcon } from "@heroicons/react/24/outline"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const ISO_FORMAT = "yyyy-MM-dd"

function parseIso(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, ISO_FORMAT, new Date())
  return isValid(parsed) ? parsed : undefined
}

export interface DatePickerProps {
  value?: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  name?: string
}

/**
 * Drop-in replacement for `<Input type="date" />` — same string-in/string-out
 * contract (ISO `yyyy-MM-dd`), so existing call sites, RHF fields, and
 * validation schemas need no changes beyond swapping the component. The
 * native date input renders differently on every OS/browser and never
 * matched the rest of the system's chrome; this always renders MediShift's
 * own calendar. Built from `Popover` + `Calendar` — see DESIGN.md > Components.
 */
export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
  { value, onChange, onBlur, placeholder = "Pick a date", disabled, className, id, name },
  ref,
) {
  const [open, setOpen] = React.useState(false)
  const selected = parseIso(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={ref}
          id={id}
          name={name}
          type="button"
          disabled={disabled}
          onBlur={onBlur}
          data-empty={!selected}
          className={cn(
            // Mirrors Input's own look (44px, hairline, 8px radius, No-Halo
            // focus ring) so a date field reads identically to every other
            // field on the same form.
            "flex h-11 w-full items-center gap-2 rounded-md border border-input bg-card px-3.5 text-left text-[0.9375rem] text-foreground transition-colors duration-150 outline-none data-[empty=true]:text-muted-foreground",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="flex-1">{selected ? format(selected, "PP") : placeholder}</span>
          {selected && !disabled && (
            // A stopPropagation span rather than a nested <button>: this
            // trigger is itself a button, and a button-in-a-button is invalid
            // HTML and breaks click targeting.
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear date"
              className="cursor-pointer rounded-sm p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onChange("")
              }}
            >
              <XMarkIcon className="size-3.5" aria-hidden="true" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            onChange(date ? format(date, ISO_FORMAT) : "")
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
})
