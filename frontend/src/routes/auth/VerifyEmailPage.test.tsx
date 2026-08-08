import { StrictMode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { API_URL, server } from '@/test/server'
import { makeAuthUser, renderRoute, resetAuthStore } from '@/test/utils'
import { useAuthStore } from '@/features/auth/store'
import { VerifyEmailPage } from './VerifyEmailPage'

const render = (search: string) =>
  renderRoute(
    <StrictMode>
      <VerifyEmailPage />
    </StrictMode>,
    { path: '/verify-email', route: `/verify-email${search}` },
  )

describe('VerifyEmailPage', () => {
  beforeEach(resetAuthStore)

  it('POSTs the token exactly once, even under StrictMode', async () => {
    // Verification tokens are single-use. StrictMode double-invokes effects in
    // development, and a second POST would come back 400 — flashing a failure
    // on a verification that actually succeeded.
    let calls = 0
    server.use(
      http.post(`${API_URL}/auth/verify-email`, () => {
        calls += 1
        return HttpResponse.json({ success: true, message: 'Email verified', data: null })
      }),
    )

    render('?token=abc123')

    expect(await screen.findByText(/email verified/i)).toBeInTheDocument()
    expect(calls).toBe(1)
  })

  it('marks a signed-in session as verified so nothing keeps nagging', async () => {
    useAuthStore.setState({
      accessToken: 't',
      user: makeAuthUser({ isEmailVerified: false }),
      isBootstrapped: true,
    })

    server.use(
      http.post(`${API_URL}/auth/verify-email`, () =>
        HttpResponse.json({ success: true, message: 'Email verified', data: null }),
      ),
    )

    render('?token=abc123')

    await screen.findByText(/email verified/i)
    expect(useAuthStore.getState().user?.isEmailVerified).toBe(true)
  })

  it('surfaces the API reason on an expired token and offers no resend', async () => {
    server.use(
      http.post(`${API_URL}/auth/verify-email`, () =>
        HttpResponse.json(
          { success: false, message: 'Email verification token is invalid or has expired' },
          { status: 400 },
        ),
      ),
    )

    render('?token=stale')

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument()
    // There is no resend-verification endpoint, so neither a resend control nor
    // an "ask your administrator" instruction can be honoured. The copy must
    // say the link cannot be reissued, and must not imply a route that isn't
    // there.
    expect(screen.getByText(/can't currently be reissued/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /resend/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/ask your administrator/i)).not.toBeInTheDocument()
  })

  it('fails closed with no token, without calling the API', async () => {
    render('')

    // No handler registered: a request here trips onUnhandledRequest: 'error'.
    expect(await screen.findByText(/missing its token/i)).toBeInTheDocument()
  })
})
