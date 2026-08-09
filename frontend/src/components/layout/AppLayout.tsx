import { useEffect, useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import {
  AcademicCapIcon,
  ArrowRightOnRectangleIcon,
  ArrowsRightLeftIcon,
  Bars3Icon,
  BanknotesIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  HomeIcon,
  MegaphoneIcon,
  SparklesIcon,
  SunIcon,
  UserCircleIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuthStore } from '@/features/auth/store'
import { useLogout } from '@/features/auth/useLogout'
import { roleLabel, userDisplayName } from '@/features/auth/user'
import type { PermissionKey } from '@/features/auth/permissions'
import { routePermissions } from '@/app/navPermissions'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import medishiftLogo from '@/assets/brand/medishift-logo.png'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { GlobalSearch } from './GlobalSearch'
import { HeaderClock } from './HeaderClock'
import { QuickCreateMenu } from './QuickCreateMenu'
import { VerifyEmailBanner } from './VerifyEmailBanner'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

interface NavSection {
  label: string
  items: NavItem[]
}

/**
 * Grouped rather than one flat list — 16 ungrouped items mixing org-structure
 * entities, day-to-day self-service, and admin-only screens was the single
 * biggest source of "where is X" confusion. Permission gating for each item
 * comes from ROUTE_PERMISSIONS (any one of the listed keys grants access); an
 * item with no entry there is reachable by every authenticated role.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: HomeIcon },
      // Sits beside the Dashboard rather than under Admin: both answer "what is
      // happening on the wards", and the assistant is the fast path to the same
      // figures the Reports screen charts. Gated on the same permissions as
      // Reports via ROUTE_PERMISSIONS, so it is absent for Employees entirely.
      { to: '/assistant', label: 'AI Assistant', icon: SparklesIcon },
    ],
  },
  {
    label: 'Workforce',
    items: [
      { to: '/employees', label: 'Employees', icon: UsersIcon },
      { to: '/departments', label: 'Departments', icon: BuildingOffice2Icon },
      { to: '/positions', label: 'Positions', icon: BriefcaseIcon },
      { to: '/certifications', label: 'Certifications', icon: AcademicCapIcon },
    ],
  },
  {
    label: 'Scheduling & Time',
    items: [
      { to: '/schedules', label: 'Schedules', icon: CalendarDaysIcon },
      { to: '/attendance', label: 'Attendance', icon: ClipboardDocumentCheckIcon },
      { to: '/leave', label: 'Leave', icon: SunIcon },
      { to: '/shift-swaps', label: 'Shift Swaps', icon: ArrowsRightLeftIcon },
    ],
  },
  {
    label: 'Communication',
    items: [
      { to: '/announcements', label: 'Announcements', icon: MegaphoneIcon },
      { to: '/messages', label: 'Messages', icon: ChatBubbleLeftRightIcon },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/payroll', label: 'Payroll', icon: BanknotesIcon },
      { to: '/reports', label: 'Reports', icon: ChartBarIcon },
      { to: '/settings', label: 'Settings', icon: Cog6ToothIcon },
      { to: '/audit-logs', label: 'Audit Logs', icon: ClipboardDocumentListIcon },
    ],
  },
]

const PROFILE_ITEM: NavItem = { to: '/profile', label: 'Profile', icon: UserCircleIcon }

function isVisible(item: NavItem, held: Set<PermissionKey>): boolean {
  const permissions = routePermissions(item.to)
  return !permissions || permissions.some((key) => held.has(key))
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const location = useLocation()
  const navigate = useNavigate()

  /**
   * Below `lg` the sidebar is an off-canvas sheet rather than a permanent
   * column — DESIGN.md's "responsive behaviour is structural, not fluid: the
   * sidebar becomes a sheet". At 240px fixed it was consuming two thirds of a
   * 375px viewport and leaving every screen in the app unreadable on a phone.
   */
  const [navOpen, setNavOpen] = useState(false)

  // Navigating from the sheet should close it; otherwise the destination
  // renders underneath an open overlay.
  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  const held = new Set((user?.role.permissions ?? []).map((p) => p.key))
  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isVisible(item, held)),
  })).filter((section) => section.items.length > 0)
  const visibleItems = [...visibleSections.flatMap((section) => section.items), PROFILE_ITEM]
  const searchSections = [...visibleSections, { label: 'Account', items: [PROFILE_ITEM] }]

  const displayName = userDisplayName(user)

  const pageTitle = [...visibleItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
    ?.label

  return (
    /* The shell does not scroll — only `<main>` does.
     *
     * `fixed inset-0` rather than `h-dvh`: taking the frame out of flow means it
     * cannot contribute to the document's own scroll height, so there is exactly
     * one scrollport on the screen and no chance of the page scrolling *behind*
     * a scrolled content area. The sidebar and header therefore stay put at any
     * scroll depth instead of riding off the top.
     *
     * Auth screens don't use this layout, so their normal page scrolling on a
     * short viewport is unaffected. */
    <div className="fixed inset-0 flex overflow-hidden">
      {/* The scrim only exists while the sheet is open, and only below `lg`. */}
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-brand-navy/20 lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        className={cn(
          // Navy rail. `overflow-y-auto` is the sidebar's own scrollport for
          // when the permission-filtered nav outgrows a short viewport — it
          // never scrolls the page.
          'flex w-60 shrink-0 flex-col gap-1 overflow-y-auto bg-sidebar p-4 text-sidebar-foreground',
          'border-r border-sidebar-border',
          // Everything off-canvas is scoped to `max-lg:` rather than written as
          // a base style with `lg:` overrides. Tailwind v4 compiles
          // `translate-x-*` to the `translate` property, and a base
          // `-translate-x-full` against an `lg:translate-x-0` leaves the two
          // declarations competing for it — the sheet stayed off-screen at every
          // width. Confining the mobile treatment to `max-lg:` means the desktop
          // column has no transform to override in the first place.
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40',
          'max-lg:transition-[translate] max-lg:duration-200 motion-reduce:max-lg:transition-none',
          navOpen ? 'max-lg:translate-x-0 max-lg:shadow-overlay' : 'max-lg:-translate-x-full',
        )}
      >
        <div className="mb-5 flex items-center justify-between px-3 pt-1">
          <NavLink to="/dashboard" className="shrink-0">
            <img src={medishiftLogo} alt="MediShift" className="h-6 w-auto object-contain" />
          </NavLink>
          <button
            type="button"
            aria-label="Close navigation"
            className="-mr-2 rounded-md p-2 text-sidebar-foreground/70 hover:text-sidebar-foreground lg:hidden"
            onClick={() => setNavOpen(false)}
          >
            <XMarkIcon className="size-4" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-4">
          {visibleSections.map((section) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              <span className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-sidebar-foreground/45 uppercase">
                {section.label}
              </span>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-200 ease-out motion-reduce:transition-none',
                      // Selected takes the action teal; hover takes the lighter
                      // navy, so the two states are never confusable.
                      isActive
                        ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground/70 hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                    )
                  }
                >
                  <item.icon className="size-4.5 shrink-0" aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="mt-2 flex items-center gap-2 rounded-md border-t border-sidebar-border/60 p-2 pt-3 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar">
              <Avatar size="sm">
                <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground">
                  {initials(displayName) || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{displayName}</span>
                <span className="block truncate text-xs text-sidebar-foreground/60">
                  {roleLabel(user)}
                </span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-52">
              <DropdownMenuItem onSelect={() => navigate(PROFILE_ITEM.to)}>
                <PROFILE_ITEM.icon className="size-4" />
                {PROFILE_ITEM.label}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={logout.isPending}
                onSelect={() => logout.mutate()}
              >
                <ArrowRightOnRectangleIcon className="size-4" />
                {logout.isPending ? 'Signing out…' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {user && !user.isEmailVerified && (
          <div className="shrink-0">
            <VerifyEmailBanner email={user.email} />
          </div>
        )}
        {/* Same Navy 500 ground as the sidebar, so the rail and the bar read as
            one continuous frame around the light working area rather than a
            themed panel floating on white. See DESIGN.md > Colors. */}
        <header className="flex shrink-0 items-center gap-3 border-b border-topbar-border bg-topbar px-4 py-2 text-topbar-foreground sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            className="-ml-2 rounded-md p-2 text-topbar-foreground/70 hover:text-topbar-foreground lg:hidden"
            onClick={() => setNavOpen(true)}
          >
            <Bars3Icon className="size-5" />
          </button>
          {pageTitle && (
            <h1 className="hidden shrink-0 text-base font-semibold tracking-tight text-topbar-foreground sm:block">
              {pageTitle}
            </h1>
          )}
          <div className="flex flex-1 justify-center px-2 sm:px-6">
            <GlobalSearch sections={searchSections} />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <HeaderClock />
            <div className="hidden h-8 w-px bg-topbar-border md:block" />
            <QuickCreateMenu held={held} />
            <NotificationBell />
          </div>
        </header>
        {/* The app's only scrollport. Keeps the Paper ground from `body`, so
            white panels sit a half-step above it and the navy rail carries the
            screen's contrast instead. */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* No fade wrapper here: this panel used to enter via a `motion.div`
              (initial="hidden" -> animate="visible"), but fast consecutive
              navigations (rapid sidebar clicks, ~80ms apart — an entirely
              normal fast-click rate) reliably left it stuck at its "hidden"
              inline style (opacity: 0) forever, reading as a blank page. That
              held even after switching off `AnimatePresence`'s exit tracking
              (a related but separate bug — its abandoned exit state left an
              invisible, full-height orphan panel in flow that pushed the
              real content out of view). Per DESIGN.md, page-load motion is
              already a narrow amendment to "don't animate content the user
              came to read" — it isn't worth this fragility, so the route
              panel now just swaps synchronously with the route. */}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
