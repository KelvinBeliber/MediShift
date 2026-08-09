import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { API_URL, server } from '@/test/server'
import { makeAuthUser, renderRoute, resetAuthStore } from '@/test/utils'
import { useAuthStore } from '@/features/auth/store'
import { RequireAnyPermission } from '@/app/guards'
import { ROUTE_PERMISSIONS } from '@/app/navPermissions'
import type { Permission } from '@/features/auth/types'
import type { PermissionKey, RoleName } from '@/features/auth/permissions'
import { AssistantPage } from './AssistantPage'

/**
 * `server.listen({ onUnhandledRequest: 'error' })` in `test/setup.ts` makes the
 * gating directly assertable: the Employee case registers **no** assistant
 * handlers, so a regression that let the screen render would fail on the
 * unhandled `/assistant/capabilities` request rather than pass quietly.
 */

function envelope<T>(data: T) {
  return HttpResponse.json({ success: true, message: 'ok', data })
}

function permissions(...keys: PermissionKey[]): Permission[] {
  return keys.map((key) => ({ key, module: key.split(':')[0]! }))
}

function signIn(roleName: RoleName, keys: PermissionKey[]) {
  useAuthStore.setState({
    accessToken: 'test-token',
    isBootstrapped: true,
    user: makeAuthUser({ role: { id: 'r1', name: roleName, permissions: permissions(...keys) } }),
  })
}

function capabilities(overrides: Record<string, unknown> = {}) {
  return http.get(`${API_URL}/assistant/capabilities`, () =>
    envelope({
      available: true,
      scope: 'hospital',
      rateLimit: { limit: 20, windowMinutes: 60 },
      ...overrides,
    }),
  )
}

/** The screen behind the same guard the router applies, so the gate is under test too. */
function guarded() {
  return (
    <RequireAnyPermission permissions={ROUTE_PERMISSIONS['/assistant']}>
      <AssistantPage />
    </RequireAnyPermission>
  )
}

beforeEach(() => {
  resetAuthStore()
})

describe('AssistantPage — permission gate', () => {
  it('bounces an Employee to the dashboard without calling the API', async () => {
    // Deliberately no handlers: any request here fails the test.
    signIn('employee', ['schedule:view', 'leave:request', 'attendance:record_own'])

    renderRoute(guarded(), { path: '/assistant', route: '/assistant' })

    expect(await screen.findByText('dashboard screen')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /AI Assistant/i })).not.toBeInTheDocument()
  })

  it('bounces a Shift Coordinator, who holds neither report:view nor analytics:view', async () => {
    signIn('shift_coordinator', ['schedule:view', 'schedule:edit', 'attendance:view'])

    renderRoute(guarded(), { path: '/assistant', route: '/assistant' })

    expect(await screen.findByText('dashboard screen')).toBeInTheDocument()
  })

  it('admits a Department Head, who holds report:view', async () => {
    server.use(capabilities({ scope: 'department', departmentName: 'Oncology' }))
    signIn('department_head', ['report:view', 'schedule:view'])

    renderRoute(guarded(), { path: '/assistant', route: '/assistant' })

    expect(await screen.findByRole('heading', { name: 'AI Assistant' })).toBeInTheDocument()
  })
})

describe('AssistantPage — scope is stated, not implied', () => {
  it('tells a Department Head their answers cover only their department', async () => {
    server.use(capabilities({ scope: 'department', departmentName: 'Oncology' }))
    signIn('department_head', ['report:view'])

    renderRoute(guarded(), { path: '/assistant', route: '/assistant' })

    expect(await screen.findByText(/Answers cover Oncology only/i)).toBeInTheDocument()
    expect(screen.getByText(/Salary is never included/i)).toBeInTheDocument()
    expect(screen.getByText(/20 questions an hour/i)).toBeInTheDocument()
  })

  it('tells an HR Manager their answers cover every department', async () => {
    server.use(capabilities())
    signIn('hr_manager', ['report:view', 'analytics:view'])

    renderRoute(guarded(), { path: '/assistant', route: '/assistant' })

    expect(await screen.findByText(/Answers cover every department/i)).toBeInTheDocument()
  })
})

describe('AssistantPage — asking a question', () => {
  it('shows the answer and what it was read from', async () => {
    server.use(
      capabilities(),
      http.post(`${API_URL}/assistant/ask`, () =>
        envelope({
          answer: 'Ada Nurse worked the most overtime in March, at 4 hours.',
          toolCalls: [
            { tool: 'list_departments', input: {}, ok: true },
            { tool: 'get_overtime_summary', input: {}, ok: true },
          ],
          scope: 'hospital',
          model: 'claude-opus-5',
        }),
      ),
    )
    signIn('hr_manager', ['report:view', 'analytics:view'])

    const { user } = renderRoute(guarded(), { path: '/assistant', route: '/assistant' })

    const box = await screen.findByLabelText(/Ask the assistant a question/i)
    await user.type(box, 'Who worked the most overtime?')
    await user.click(screen.getByRole('button', { name: /Send question/i }))

    expect(await screen.findByText(/Ada Nurse worked the most overtime/i)).toBeInTheDocument()
    // The question stays on screen as the user's own turn.
    expect(screen.getByText('Who worked the most overtime?')).toBeInTheDocument()
    // The receipt: which tools the answer was actually read from.
    expect(screen.getByText('Looked up departments')).toBeInTheDocument()
    expect(screen.getByText('Read overtime records')).toBeInTheDocument()
  })

  it('strips markdown emphasis the model emits despite being asked not to', async () => {
    server.use(
      capabilities(),
      http.post(`${API_URL}/assistant/ask`, () =>
        envelope({
          // Observed live: the model bolds figures out of habit. Rendered as
          // literal text, the markers would show up on screen as asterisks.
          answer: 'Cardiology is short **three people** on __10 June__.',
          toolCalls: [],
          scope: 'hospital',
          model: 'm',
        }),
      ),
    )
    signIn('hr_manager', ['report:view', 'analytics:view'])

    const { user } = renderRoute(guarded(), { path: '/assistant', route: '/assistant' })

    await user.type(await screen.findByLabelText(/Ask the assistant a question/i), 'how short?')
    await user.click(screen.getByRole('button', { name: /Send question/i }))

    expect(
      await screen.findByText('Cardiology is short three people on 10 June.'),
    ).toBeInTheDocument()
  })

  it('sends a suggested question on click', async () => {
    let asked = ''
    server.use(
      capabilities(),
      http.post(`${API_URL}/assistant/ask`, async ({ request }) => {
        asked = ((await request.json()) as { question: string }).question
        return envelope({ answer: 'Cardiology, by three people.', toolCalls: [], scope: 'hospital', model: 'm' })
      }),
    )
    signIn('hr_manager', ['report:view', 'analytics:view'])

    const { user } = renderRoute(guarded(), { path: '/assistant', route: '/assistant' })

    const suggestion = await screen.findByRole('button', {
      name: /Which department is most understaffed/i,
    })
    await user.click(suggestion)

    expect(await screen.findByText('Cardiology, by three people.')).toBeInTheDocument()
    expect(asked).toMatch(/Which department is most understaffed/i)
  })

  it("replays the transcript so a follow-up isn't asked cold", async () => {
    const bodies: { question: string; history: { role: string; content: string }[] }[] = []
    server.use(
      capabilities(),
      http.post(`${API_URL}/assistant/ask`, async ({ request }) => {
        const body = (await request.json()) as (typeof bodies)[number]
        bodies.push(body)
        return envelope({
          answer: `reply ${bodies.length}`,
          toolCalls: [],
          scope: 'hospital',
          model: 'm',
        })
      }),
    )
    signIn('hr_manager', ['report:view', 'analytics:view'])

    const { user } = renderRoute(guarded(), { path: '/assistant', route: '/assistant' })

    const box = await screen.findByLabelText(/Ask the assistant a question/i)
    await user.type(box, 'first question')
    await user.click(screen.getByRole('button', { name: /Send question/i }))
    expect(await screen.findByText('reply 1')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Ask the assistant a question/i), 'second question')
    await user.click(screen.getByRole('button', { name: /Send question/i }))
    expect(await screen.findByText('reply 2')).toBeInTheDocument()

    expect(bodies).toHaveLength(2)
    expect(bodies[0]?.history).toEqual([])
    expect(bodies[1]?.history).toEqual([
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'reply 1' },
    ])
  })

  it("surfaces the backend's own error copy rather than a generic failure", async () => {
    server.use(
      capabilities(),
      http.post(`${API_URL}/assistant/ask`, () =>
        HttpResponse.json(
          {
            success: false,
            message:
              "You've reached the limit of 20 assistant questions per hour. Reports and Analytics are still available.",
          },
          { status: 429 },
        ),
      ),
    )
    signIn('hr_manager', ['report:view', 'analytics:view'])

    const { user } = renderRoute(guarded(), { path: '/assistant', route: '/assistant' })

    const box = await screen.findByLabelText(/Ask the assistant a question/i)
    await user.type(box, 'one too many')
    await user.click(screen.getByRole('button', { name: /Send question/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/limit of 20 assistant questions per hour/i)
    expect(alert).toHaveTextContent(/Reports and Analytics are still available/i)
  })

  it('does not replay a failed turn as something the assistant said', async () => {
    const bodies: { history: unknown[] }[] = []
    let calls = 0
    server.use(
      capabilities(),
      http.post(`${API_URL}/assistant/ask`, async ({ request }) => {
        bodies.push((await request.json()) as { history: unknown[] })
        calls += 1
        if (calls === 1) {
          return HttpResponse.json({ success: false, message: 'Temporarily unavailable.' }, { status: 503 })
        }
        return envelope({ answer: 'recovered', toolCalls: [], scope: 'hospital', model: 'm' })
      }),
    )
    signIn('hr_manager', ['report:view', 'analytics:view'])

    const { user } = renderRoute(guarded(), { path: '/assistant', route: '/assistant' })

    const box = await screen.findByLabelText(/Ask the assistant a question/i)
    await user.type(box, 'first')
    await user.click(screen.getByRole('button', { name: /Send question/i }))
    await screen.findByRole('alert')

    await user.type(screen.getByLabelText(/Ask the assistant a question/i), 'second')
    await user.click(screen.getByRole('button', { name: /Send question/i }))
    expect(await screen.findByText('recovered')).toBeInTheDocument()

    // The error bubble is not in the replayed transcript.
    expect(bodies).toHaveLength(2)
    expect(bodies[1]?.history).toEqual([])
  })
})

describe('AssistantPage — unconfigured server', () => {
  it('says so instead of inviting a question it cannot answer', async () => {
    server.use(capabilities({ available: false }))
    signIn('hr_manager', ['report:view', 'analytics:view'])

    renderRoute(guarded(), { path: '/assistant', route: '/assistant' })

    expect(await screen.findByText(/The assistant is not configured/i)).toBeInTheDocument()
    expect(screen.getByText(/ANTHROPIC_API_KEY/)).toBeInTheDocument()
    // Names what still works, per DESIGN.md's rule on dead recovery copy.
    expect(screen.getByText(/Reports and Analytics work without it/i)).toBeInTheDocument()
    // And there is no composer to type into.
    await waitFor(() => {
      expect(screen.queryByLabelText(/Ask the assistant a question/i)).not.toBeInTheDocument()
    })
  })
})
