import { useEffect, useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

interface SearchableItem {
  to: string
  label: string
  icon?: ComponentType<SVGProps<SVGSVGElement>>
}

interface SearchableSection {
  label: string
  items: SearchableItem[]
}

interface GlobalSearchProps {
  sections: SearchableSection[]
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

/**
 * A command palette, not just a dropdown — ⌘K/Ctrl+K opens it from anywhere
 * in the app, cmdk owns the fuzzy match and arrow-key navigation, and results
 * are grouped the same way the nav rail is. Client-side quick nav over the
 * screens the current user can reach — no backend endpoint exists for a
 * cross-entity search yet, so this stays scoped to the nav rather than
 * pretending to search employees/shifts too.
 */
export function GlobalSearch({ sections }: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  function select(item: SearchableItem) {
    setOpen(false)
    void navigate(item.to)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search screens"
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border border-topbar-accent bg-topbar-accent/60 px-3 text-sm text-topbar-foreground/50 transition-colors duration-150 hover:bg-topbar-accent focus-visible:border-topbar-ring focus-visible:ring-2 focus-visible:ring-topbar-ring focus-visible:outline-none"
      >
        <MagnifyingGlassIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden shrink-0 rounded-sm border border-topbar-foreground/20 bg-topbar px-1.5 py-0.5 font-mono text-[0.6875rem] text-topbar-foreground/50 sm:inline-block">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search screens"
        description="Jump to any screen you have access to"
        // The default Dialog close button sits at a fixed top-4/right-4,
        // which assumes the card's own p-6 — CommandDialog overrides that to
        // p-0, so the button lands on top of the search input instead of in
        // its own corner. Escape and click-outside already close this.
        showCloseButton={false}
      >
        <CommandInput placeholder="Search screens…" />
        <CommandList>
          <CommandEmpty>No screens found.</CommandEmpty>
          {sections.map((section) => (
            <CommandGroup key={section.label} heading={section.label}>
              {section.items.map((item) => (
                <CommandItem key={item.to} value={item.label} onSelect={() => select(item)}>
                  {item.icon && <item.icon className="size-4" aria-hidden="true" />}
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}
