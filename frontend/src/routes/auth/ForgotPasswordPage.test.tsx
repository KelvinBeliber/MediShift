import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { API_URL, server } from '@/test/server'
import { renderRoute, resetAuthStore } from '@/test/utils'
import { ForgotPasswordPage } from './ForgotPasswordPage'

const render = () =>
  renderRoute(<ForgotPasswordPage />, { path: '/forgot-password', route: '/forgot-password' })

const submitWith = async (user: ReturnType<typeof renderRoute>['user'], email: string) => {
  await user.type(screen.getByLabelText(/work email/i), email)
  await user.click(screen.getByRole('button', { name: /send reset link/i }))
}

describe('ForgotPasswordPage', () => {
  beforeEach(resetAuthStore)

  // The API returns the same 200 whether or not the account exists, precisely
  // so the endpoint cannot be used to enumerate staff emails. The UI must not
  // undo that by confirming delivery.
  it.each([
    ['a known address', 'admin@medishift.local'],
    ['an unknown address', 'nobody@nowhere.test'],
  ])('gives the same non-committal answer for %s', async (_label, email) => {
    server.use(
      http.post(`${API_URL}/auth/forgot-password`, () =>
        HttpResponse.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
          data: null,
        }),
      ),
    )

    const { user } = render()
    await submitWith(user, email)

    expect(await screen.findByText(/if an account with that email exists/i)).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(email, 'i'))).not.toBeInTheDocument()
  })

  it('validates the email before calling the API', async () => {
    const { user } = render()
    await submitWith(user, 'not-an-email')

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument()
  })
})
