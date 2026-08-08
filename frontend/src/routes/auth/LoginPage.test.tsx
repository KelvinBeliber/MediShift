import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { API_URL, server } from '@/test/server'
import { makeAuthUser, renderRoute, resetAuthStore } from '@/test/utils'
import { useAuthStore } from '@/features/auth/store'
import { LoginPage } from './LoginPage'

const ok = (data: unknown) => HttpResponse.json({ success: true, message: 'ok', data })

const fill = async (user: ReturnType<typeof renderRoute>['user']) => {
  await user.type(screen.getByLabelText(/work email/i), 'rosa.delgado@hospital.org')
  await user.type(screen.getByLabelText(/^password$/i), 'NightShift2026')
  await user.click(screen.getByRole('button', { name: /sign in/i }))
}

describe('LoginPage', () => {
  beforeEach(resetAuthStore)

  it('builds the session from GET /auth/me, not from the login payload', async () => {
    // The login response deliberately carries `role` as a bare string with no
    // permissions. If the store were populated from it, hasPermission() would
    // be false forever and every permission-gated nav item would disappear.
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        ok({
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          user: { id: 'u1', email: 'rosa.delgado@hospital.org', role: 'employee' },
        }),
      ),
      http.get(`${API_URL}/auth/me`, () => ok(makeAuthUser())),
    )

    const { user } = renderRoute(<LoginPage />, { path: '/login', route: '/login' })
    await fill(user)

    await waitFor(() => expect(screen.getByText('dashboard screen')).toBeInTheDocument())

    const state = useAuthStore.getState()
    expect(state.accessToken).toBe('access-1')
    expect(state.user?.role).toMatchObject({ name: 'employee' })
    expect(state.user?.role.permissions.map((p) => p.key)).toContain('schedule:view')
  })

  it('shows the API message inline on bad credentials and keeps the email', async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json(
          { success: false, message: 'Invalid email or password' },
          { status: 401 },
        ),
      ),
    )

    const { user } = renderRoute(<LoginPage />, { path: '/login', route: '/login' })
    await fill(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(screen.getByLabelText(/work email/i)).toHaveValue('rosa.delgado@hospital.org')
    expect(screen.getByLabelText(/^password$/i)).toHaveValue('')
    expect(useAuthStore.getState().user).toBeNull()
  })

  // The limiter window is 15 minutes (authLimiter in auth.routes.ts), so vague
  // "a few minutes" advice earns the user a second 429.
  it('translates a 429 into the real wait, not the raw limiter message', async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json(
          { success: false, message: 'Too many attempts. Please try again later.' },
          { status: 429 },
        ),
      ),
    )

    const { user } = renderRoute(<LoginPage />, { path: '/login', route: '/login' })
    await fill(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(/wait 15 minutes/i)
  })

  it('tears the session down if /auth/me fails after a successful login', async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        ok({ accessToken: 'access-1', refreshToken: 'r', user: { id: 'u1', email: 'a@b.c' } }),
      ),
      http.get(`${API_URL}/auth/me`, () =>
        HttpResponse.json({ success: false, message: 'Account is inactive' }, { status: 401 }),
      ),
    )

    const { user } = renderRoute(<LoginPage />, { path: '/login', route: '/login' })
    await fill(user)

    await screen.findByRole('alert')
    // A token with no user would leave the guards bouncing with no explanation.
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('validates before it calls the API', async () => {
    const { user } = renderRoute(<LoginPage />, { path: '/login', route: '/login' })
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // No msw handler is registered, so a request here would fail the run
    // outright via onUnhandledRequest: 'error'.
    expect(await screen.findByText(/enter your work email/i)).toBeInTheDocument()
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument()
  })
})
