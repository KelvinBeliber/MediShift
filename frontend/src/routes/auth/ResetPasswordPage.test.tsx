import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { API_URL, server } from '@/test/server'
import { makeAuthUser, renderRoute, resetAuthStore } from '@/test/utils'
import { useAuthStore } from '@/features/auth/store'
import { ResetPasswordPage } from './ResetPasswordPage'

const render = (search: string) =>
  renderRoute(<ResetPasswordPage />, {
    path: '/reset-password',
    route: `/reset-password${search}`,
  })

type User = ReturnType<typeof renderRoute>['user']

// Anchored: an unanchored /new password/ also matches "Confirm new password".
const NEW_PASSWORD = /^new password$/i
const CONFIRM_PASSWORD = /^confirm new password$/i

async function setPassword(user: User, value = 'NightShift2026', confirm = value) {
  await user.type(screen.getByLabelText(NEW_PASSWORD), value)
  await user.type(screen.getByLabelText(CONFIRM_PASSWORD), confirm)
  await user.click(screen.getByRole('button', { name: /set new password/i }))
}

describe('ResetPasswordPage', () => {
  beforeEach(resetAuthStore)

  it('renders a dead end when the link has no token, without calling the API', async () => {
    render('')

    // No handler registered: a request here trips onUnhandledRequest: 'error'.
    expect(await screen.findByText(/this link is incomplete/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /request a new reset link/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    expect(screen.queryByLabelText(NEW_PASSWORD)).not.toBeInTheDocument()
  })

  it('sends the token with `newPassword`, matching change-password', async () => {
    let body: Record<string, unknown> | null = null
    server.use(
      http.post(`${API_URL}/auth/reset-password`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ success: true, message: 'ok', data: null })
      }),
    )

    const { user } = render('?token=tok-1')
    await setPassword(user)

    await screen.findByText(/password updated/i)
    expect(body).toEqual({ token: 'tok-1', newPassword: 'NightShift2026' })
  })

  it('drops the local session, since the API revokes every refresh token', async () => {
    useAuthStore.setState({ accessToken: 't', user: makeAuthUser(), isBootstrapped: true })
    server.use(
      http.post(`${API_URL}/auth/reset-password`, () =>
        HttpResponse.json({ success: true, message: 'ok', data: null }),
      ),
    )

    const { user } = render('?token=tok-1')
    await setPassword(user)

    await screen.findByText(/password updated/i)
    await waitFor(() => expect(useAuthStore.getState().user).toBeNull())
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it('offers a fresh link when the token has expired', async () => {
    server.use(
      http.post(`${API_URL}/auth/reset-password`, () =>
        HttpResponse.json(
          { success: false, message: 'Password reset token is invalid or has expired' },
          { status: 400 },
        ),
      ),
    )

    const { user } = render('?token=stale')
    await setPassword(user)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/invalid or has expired/i)
    expect(screen.getByRole('link', { name: /request a new link/i })).toBeInTheDocument()
  })

  it('rejects mismatched passwords without calling the API', async () => {
    const { user } = render('?token=tok-1')
    await setPassword(user, 'NightShift2026', 'SomethingElse1')

    expect(await screen.findByText(/both passwords must match/i)).toBeInTheDocument()
  })
})
