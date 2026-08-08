import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // MediShift: 44px tall for shared ward tablets, flat at rest, and a 2px
        // ring at 2px offset on focus rather than a glow. See DESIGN.md.
        "h-11 w-full min-w-0 rounded-md border border-input bg-card px-3.5 py-1 text-[0.9375rem] transition-colors duration-150 outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
