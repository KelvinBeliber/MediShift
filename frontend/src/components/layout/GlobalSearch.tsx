import { useEffect, useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import { MagnifyingGlassIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { employeesApi } from '@/features/employees/api'
import { usePermission } from '@/features/auth/usePermission'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

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
 * in the app, cmdk owns the fuzzy match and arrow-key navigation over the
 * nav sections, and a debounced employee lookup is layered on top of that
 * (query controlled here rather than left to cmdk, since employee results
 * come from the network and need their own group + loading gap).
 */
export function GlobalSearch({ sections }: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const canViewEmployees = usePermission('employee:view')
  const debouncedQuery = useDebouncedValue(query, 300)

  const { data: employeeResults, isFetching } = useQuery({
    queryKey: ['global-search', 'employees', debouncedQuery],
    queryFn: () => employeesApi.list({ search: debouncedQuery, page: 1, limit: 5 }),
    enabled: open && canViewEmployees && debouncedQuery.trim().length > 0,
  })

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

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setQuery('')
  }

  function select(item: SearchableItem) {
    onOpenChange(false)
    void navigate(item.to)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search everything"
        className="flex h-9 w-full max-w-xl items-center gap-2 rounded-md border border-topbar-accent bg-topbar-accent/60 px-3 text-sm text-topbar-foreground/50 transition-colors duration-150 hover:bg-topbar-accent focus-visible:border-topbar-ring focus-visible:ring-2 focus-visible:ring-topbar-ring focus-visible:outline-none"
      >
        <MagnifyingGlassIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">Search employees, screens…</span>
        <kbd className="hidden shrink-0 rounded-sm border border-topbar-foreground/20 bg-topbar px-1.5 py-0.5 font-mono text-[0.6875rem] text-topbar-foreground/50 sm:inline-block">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Search"
        description="Find employees or jump to any screen you have access to"
        // The default Dialog close button sits at a fixed top-4/right-4,
        // which assumes the card's own p-6 — CommandDialog overrides that to
        // p-0, so the button lands on top of the search input instead of in
        // its own corner. Escape and click-outside already close this.
        showCloseButton={false}
      >
        <CommandInput
          placeholder="Search employees, screens…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {isFetching ? 'Searching…' : 'No results found.'}
          </CommandEmpty>
          {canViewEmployees && debouncedQuery.trim().length > 0 && employeeResults && employeeResults.data.length > 0 && (
            <CommandGroup heading="Employees">
              {employeeResults.data.map((employee) => (
                <CommandItem
                  key={employee.id}
                  value={`employee-${employee.id}-${employee.firstName}-${employee.lastName}`}
                  onSelect={() => select({ to: `/employees/${employee.id}`, label: employee.firstName })}
                >
                  <UserCircleIcon className="size-4" aria-hidden="true" />
                  <span className="flex-1">
                    {employee.firstName} {employee.lastName}
                  </span>
                  <span className="text-xs text-muted-foreground">{employee.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
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
