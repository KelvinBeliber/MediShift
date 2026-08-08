import { useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchableItem {
  to: string
  label: string
}

interface GlobalSearchProps {
  items: SearchableItem[]
}

/**
 * Client-side quick nav over the screens the current user can reach — no
 * backend endpoint exists for a cross-entity search yet, so this stays
 * scoped to the nav rather than pretending to search employees/shifts too.
 */
export function GlobalSearch({ items }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 8)
  }, [items, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function select(item: SearchableItem) {
    setQuery('')
    setOpen(false)
    void navigate(item.to)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = results[activeIndex]
      if (item) select(item)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-9 pl-9"
        aria-label="Search screens"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover py-1 text-popover-foreground shadow-overlay">
          {results.map((item, index) => (
            <button
              key={item.to}
              type="button"
              className={cn(
                'block w-full px-3 py-2 text-left text-sm',
                index === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground',
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
