import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { useAuthStore } from '@/features/auth/store'
import type { AuthUser } from '@/features/auth/types'

/**
 * Renders a route component inside the providers it actually needs: a memory
 * router (every auth screen has `Link`s and most navigate) and a query client
 * with retries off so a deliberate 4xx in a test fails fast.
 */
export function renderRoute(
  element: ReactElement,
  { path = '/', route = '/' }: { path?: string; route?: string } = {},
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  const router = createMemoryRouter(
    [
      { path, element },
      // Stand-ins so a redirect has somewhere to land and asserts cleanly.
      { path: '/dashboard', element: <div>dashboard screen</div> },
      { path: '/login', element: <div>login screen</div> },
      { path: '*', element: <div>elsewhere</div> },
    ],
    { initialEntries: [route] },
  )

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  }
}

/**
 * The auth store is a module singleton, so state leaks between tests unless it
 * is reset. Call in `beforeEach`.
 */
export function resetAuthStore() {
  useAuthStore.setState({ accessToken: null, user: null, isBootstrapped: true })
}

/** A `GET /auth/me` payload — role as an object, permissions as objects. */
export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'u1',
    email: 'rosa.delgado@hospital.org',
    isEmailVerified: true,
    isActive: true,
    role: {
      id: 'r1',
      name: 'employee',
      permissions: [
        { key: 'schedule:view', module: 'schedule' },
        { key: 'leave:request', module: 'leave' },
      ],
    },
    ...overrides,
  }
}
