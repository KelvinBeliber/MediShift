import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { API_URL, server } from '@/test/server'
import { renderRoute, resetAuthStore } from '@/test/utils'
import { RegisterPage } from './RegisterPage'

type User = ReturnType<typeof renderRoute>['user']

async function fillValidForm(user: User, { employeeId = 'EMP-000123' } = {}) {
  await user.type(screen.getByLabelText(/employee id/i), employeeId)
  await user.type(screen.getByLabelText(/first name/i), 'Rosa')
  await user.type(screen.getByLabelText(/last name/i), 'Delgado')
  await user.type(screen.getByLabelText(/work email/i), 'rosa.delgado@hospital.org')
  await user.type(screen.getByLabelText(/^password$/i), 'NightShift2026')
  await user.type(screen.getByLabelText(/confirm password/i), 'NightShift2026')
}

const submit = (user: User) => user.click(screen.getByRole('button', { name: /create account/i }))

const render = () => renderRoute(<RegisterPage />, { path: '/register', route: '/register' })

describe('RegisterPage', () => {
  beforeEach(resetAuthStore)

  it('routes the "no employee record" 400 onto the employee ID field', async () => {
    // The API answers a bad claim with a plain 400 and no `details[]`, so there
    // is nothing for applyFieldErrors to map. Landing it on the right field is
    // what makes the error actionable.
    server.use(
      http.post(`${API_URL}/auth/register`, () =>
        HttpResponse.json(
          { success: false, message: 'No employee record found for the provided employee ID' },
          { status: 400 },
        ),
      ),
    )

    const { user } = render()
    await fillValidForm(user, { employeeId: 'EMP-999999' })
    await submit(user)

    const field = screen.getByLabelText(/employee id/i)
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByText(/no employee record found/i)).toBeInTheDocument()
    expect(field).toHaveFocus()
  })

  it('routes an email mismatch onto the email field instead', async () => {
    server.use(
      http.post(`${API_URL}/auth/register`, () =>
        HttpResponse.json(
          { success: false, message: 'Email does not match the employee record on file' },
          { status: 400 },
        ),
      ),
    )

    const { user } = render()
    await fillValidForm(user)
    await submit(user)

    await waitFor(() =>
      expect(screen.getByLabelText(/work email/i)).toHaveAttribute('aria-invalid', 'true'),
    )
    expect(screen.getByLabelText(/employee id/i)).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('sends an uppercased employee ID and drops the client-only confirm field', async () => {
    let body: Record<string, unknown> | null = null
    server.use(
      http.post(`${API_URL}/auth/register`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          { success: true, message: 'ok', data: { id: 'u1', email: 'rosa.delgado@hospital.org' } },
          { status: 201 },
        )
      }),
    )

    const { user } = render()
    await fillValidForm(user, { employeeId: 'emp-000123' })
    await submit(user)

    await screen.findByText(/check your email/i)
    expect(body).toMatchObject({ employeeId: 'EMP-000123', email: 'rosa.delgado@hospital.org' })
    expect(body).not.toHaveProperty('confirmPassword')
  })

  it('requires an employee ID even though the API treats it as optional', async () => {
    const { user } = render()
    await submit(user)

    expect(await screen.findByText(/employee id from your onboarding email/i)).toBeInTheDocument()
  })

  it('rejects mismatched passwords without calling the API', async () => {
    const { user } = render()
    await fillValidForm(user)
    await user.clear(screen.getByLabelText(/confirm password/i))
    await user.type(screen.getByLabelText(/confirm password/i), 'SomethingElse1')
    await submit(user)

    expect(await screen.findByText(/both passwords must match/i)).toBeInTheDocument()
  })
})
