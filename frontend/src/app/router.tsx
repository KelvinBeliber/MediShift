import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAnonymous, RequireAnyPermission, RequireAuth, RequirePermission } from './guards'
import { AppLayout } from '@/components/layout/AppLayout'
import { FullPageSpinner } from '@/components/layout/FullPageSpinner'
import { ROUTE_PERMISSIONS } from './navPermissions'

/**
 * Every route component is loaded lazily and route-split — with 25 screens
 * (FullCalendar + visx among them) eagerly importing everything produced a
 * 559kB/174kB-gzip bundle. `lazyRoute` wraps the dynamic import in its own
 * Suspense boundary so navigating to one heavy screen doesn't block on another.
 */
function lazyRoute(loader: () => Promise<{ default: ComponentType }>) {
  const LazyComponent = lazy(loader)
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <LazyComponent />
    </Suspense>
  )
}

const ForgotPasswordPage = () =>
  import('@/routes/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
const LoginPage = () => import('@/routes/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
const RegisterPage = () => import('@/routes/auth/RegisterPage').then((m) => ({ default: m.RegisterPage }))
const ResetPasswordPage = () =>
  import('@/routes/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
const VerifyEmailPage = () =>
  import('@/routes/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage }))

const EmployeesListPage = () =>
  import('@/routes/employees/EmployeesListPage').then((m) => ({ default: m.EmployeesListPage }))
const EmployeeDetailPage = () =>
  import('@/routes/employees/EmployeeDetailPage').then((m) => ({ default: m.EmployeeDetailPage }))

const DepartmentsListPage = () =>
  import('@/routes/departments/DepartmentsListPage').then((m) => ({ default: m.DepartmentsListPage }))
const DepartmentDetailPage = () =>
  import('@/routes/departments/DepartmentDetailPage').then((m) => ({ default: m.DepartmentDetailPage }))

const PositionsPage = () => import('@/routes/PositionsPage').then((m) => ({ default: m.PositionsPage }))
const CertificationsPage = () =>
  import('@/routes/CertificationsPage').then((m) => ({ default: m.CertificationsPage }))

const Dashboard = () => import('@/features/dashboard/Dashboard').then((m) => ({ default: m.Dashboard }))

const AttendancePage = () => import('@/routes/AttendancePage').then((m) => ({ default: m.AttendancePage }))
const LeavePage = () => import('@/routes/LeavePage').then((m) => ({ default: m.LeavePage }))
const NotFoundPage = () => import('@/routes/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))

const SchedulesListPage = () =>
  import('@/routes/schedules/SchedulesListPage').then((m) => ({ default: m.SchedulesListPage }))
const ScheduleDetailPage = () =>
  import('@/routes/schedules/ScheduleDetailPage').then((m) => ({ default: m.ScheduleDetailPage }))

const ShiftSwapsPage = () => import('@/routes/ShiftSwapsPage').then((m) => ({ default: m.ShiftSwapsPage }))
const AnnouncementsPage = () =>
  import('@/routes/AnnouncementsPage').then((m) => ({ default: m.AnnouncementsPage }))
const MessagesPage = () => import('@/routes/MessagesPage').then((m) => ({ default: m.MessagesPage }))
const PayrollPage = () => import('@/routes/PayrollPage').then((m) => ({ default: m.PayrollPage }))
const ReportsPage = () => import('@/routes/ReportsPage').then((m) => ({ default: m.ReportsPage }))
const ProfilePage = () => import('@/routes/ProfilePage').then((m) => ({ default: m.ProfilePage }))
const SettingsPage = () => import('@/routes/SettingsPage').then((m) => ({ default: m.SettingsPage }))
const AuditLogsPage = () => import('@/routes/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage }))

export const router = createBrowserRouter([
  {
    element: <RequireAnonymous />,
    children: [
      { path: '/login', element: lazyRoute(LoginPage) },
      { path: '/register', element: lazyRoute(RegisterPage) },
      { path: '/forgot-password', element: lazyRoute(ForgotPasswordPage) },
    ],
  },
  // Both of these are reached from a link in an email, which the recipient may
  // well open in a browser they are already signed in to. Guarding them with
  // RequireAnonymous would silently bounce those users to /dashboard and leave
  // the link looking broken, so they stay public.
  { path: '/reset-password', element: lazyRoute(ResetPasswordPage) },
  { path: '/verify-email', element: lazyRoute(VerifyEmailPage) },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: lazyRoute(Dashboard) },

          {
            element: <RequirePermission permission={ROUTE_PERMISSIONS['/employees'][0]} />,
            children: [
              { path: '/employees', element: lazyRoute(EmployeesListPage) },
              { path: '/employees/:id', element: lazyRoute(EmployeeDetailPage) },
            ],
          },
          {
            element: <RequirePermission permission={ROUTE_PERMISSIONS['/departments'][0]} />,
            children: [
              { path: '/departments', element: lazyRoute(DepartmentsListPage) },
              { path: '/departments/:id', element: lazyRoute(DepartmentDetailPage) },
            ],
          },
          {
            path: '/positions',
            element: (
              <RequirePermission permission={ROUTE_PERMISSIONS['/positions'][0]}>
                {lazyRoute(PositionsPage)}
              </RequirePermission>
            ),
          },
          {
            path: '/certifications',
            element: (
              <RequirePermission permission={ROUTE_PERMISSIONS['/certifications'][0]}>
                {lazyRoute(CertificationsPage)}
              </RequirePermission>
            ),
          },
          {
            element: <RequirePermission permission={ROUTE_PERMISSIONS['/schedules'][0]} />,
            children: [
              { path: '/schedules', element: lazyRoute(SchedulesListPage) },
              { path: '/schedules/:id', element: lazyRoute(ScheduleDetailPage) },
            ],
          },

          { path: '/attendance', element: lazyRoute(AttendancePage) },
          { path: '/leave', element: lazyRoute(LeavePage) },
          { path: '/shift-swaps', element: lazyRoute(ShiftSwapsPage) },
          { path: '/announcements', element: lazyRoute(AnnouncementsPage) },
          { path: '/messages', element: lazyRoute(MessagesPage) },

          {
            path: '/payroll',
            element: (
              <RequirePermission permission={ROUTE_PERMISSIONS['/payroll'][0]}>
                {lazyRoute(PayrollPage)}
              </RequirePermission>
            ),
          },
          {
            path: '/reports',
            element: (
              <RequireAnyPermission permissions={ROUTE_PERMISSIONS['/reports']}>
                {lazyRoute(ReportsPage)}
              </RequireAnyPermission>
            ),
          },
          { path: '/profile', element: lazyRoute(ProfilePage) },
          {
            path: '/settings',
            element: (
              <RequirePermission permission={ROUTE_PERMISSIONS['/settings'][0]}>
                {lazyRoute(SettingsPage)}
              </RequirePermission>
            ),
          },
          {
            path: '/audit-logs',
            element: (
              <RequirePermission permission={ROUTE_PERMISSIONS['/audit-logs'][0]}>
                {lazyRoute(AuditLogsPage)}
              </RequirePermission>
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: lazyRoute(NotFoundPage) },
])
