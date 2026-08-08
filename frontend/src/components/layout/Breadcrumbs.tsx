import { ChevronRightIcon } from '@heroicons/react/20/solid'
import { Link } from 'react-router'

interface BreadcrumbItem {
  label: string
  to?: string
}

/**
 * Detail screens only inherit their parent list's title in the header (the
 * sidebar's page-title matching is a `startsWith` heuristic, not a route
 * tree) — this fills the "what entity am I looking at" gap without trying to
 * make that heuristic smarter.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 && <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden="true" />}
            {item.to && !isLast ? (
              <Link to={item.to} className="hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-foreground' : undefined} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
