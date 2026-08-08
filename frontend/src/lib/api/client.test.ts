import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { API_URL, server } from '@/test/server'
import { connectTokenBridge, get } from './client'
import { ApiError } from './errors'

/** Minimal stand-in for the auth store. */
function makeBridge(initial: string | null) {
  const state = { token: initial, refreshFailures: 0 }
  connectTokenBridge({
    getAccessToken: () => state.token,
    setAccessToken: (token) => {
      state.token = token
    },
    onRefreshFailed: () => {
      state.refreshFailures += 1
    },
  })
  return state
}

function ok<T>(data: T) {
  return HttpResponse.json({ success: true, message: 'ok', data })
}

describe('api client', () => {
  beforeEach(() => {
    makeBridge('valid-token')
  })

  it('unwraps the response envelope', async () => {
    server.use(http.get(`${API_URL}/employees/me`, () => ok({ id: 'e1', firstName: 'Ada' })))

    await expect(get('/employees/me')).resolves.toEqual({ id: 'e1', firstName: 'Ada' })
  })

  it('attaches the bearer token', async () => {
    let seen: string | null = null
    server.use(
      http.get(`${API_URL}/auth/me`, ({ request }) => {
        seen = request.headers.get('authorization')
        return ok({ id: 'u1' })
      }),
    )

    await get('/auth/me')
    expect(seen).toBe('Bearer valid-token')
  })

  it('refreshes once and replays the request on 401', async () => {
    const state = makeBridge('expired')
    let refreshCalls = 0

    server.use(
      http.post(`${API_URL}/auth/refresh`, () => {
        refreshCalls += 1
        return ok({ accessToken: 'fresh-token', refreshToken: 'r' })
      }),
      http.get(`${API_URL}/employees`, ({ request }) => {
        if (request.headers.get('authorization') !== 'Bearer fresh-token') {
          return HttpResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }
        return ok([{ id: 'e1' }])
      }),
    )

    await expect(get('/employees')).resolves.toEqual([{ id: 'e1' }])
    expect(refreshCalls).toBe(1)
    expect(state.token).toBe('fresh-token')
  })

  it('refreshes only once for concurrent 401s', async () => {
    makeBridge('expired')
    let refreshCalls = 0

    server.use(
      http.post(`${API_URL}/auth/refresh`, async () => {
        refreshCalls += 1
        // Hold the refresh open so all four requests are waiting on it at once.
        await new Promise((resolve) => setTimeout(resolve, 20))
        return ok({ accessToken: 'fresh-token', refreshToken: 'r' })
      }),
      http.get(`${API_URL}/reports/dashboard`, ({ request }) => {
        if (request.headers.get('authorization') !== 'Bearer fresh-token') {
          return HttpResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
        }
        return ok({ attendanceRate: 0.9 })
      }),
    )

    const results = await Promise.all([
      get('/reports/dashboard'),
      get('/reports/dashboard'),
      get('/reports/dashboard'),
      get('/reports/dashboard'),
    ])

    expect(results).toHaveLength(4)
    expect(refreshCalls).toBe(1)
  })

  it('does not retry a failed login', async () => {
    makeBridge(null)
    let refreshCalls = 0

    server.use(
      http.post(`${API_URL}/auth/refresh`, () => {
        refreshCalls += 1
        return ok({ accessToken: 'x', refreshToken: 'r' })
      }),
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 }),
      ),
    )

    const { post } = await import('./client')
    await expect(post('/auth/login', { email: 'a@b.c', password: 'nope' })).rejects.toThrow(
      'Invalid credentials',
    )
    expect(refreshCalls).toBe(0)
  })

  it('surfaces the backend message and 422 field issues', async () => {
    server.use(
      http.post(`${API_URL}/shifts/s1/assignments`, () =>
        HttpResponse.json(
          {
            success: false,
            message: 'Employee does not hold the certification(s) required for this shift',
          },
          { status: 409 },
        ),
      ),
      http.post(`${API_URL}/employees`, () =>
        HttpResponse.json(
          {
            success: false,
            message: 'Validation failed',
            details: [{ path: 'email', message: 'Invalid email' }],
          },
          { status: 422 },
        ),
      ),
    )

    const { post } = await import('./client')

    await expect(post('/shifts/s1/assignments', {})).rejects.toThrow(
      'Employee does not hold the certification(s) required for this shift',
    )

    try {
      await post('/employees', {})
      expect.unreachable('should have thrown')
    } catch (error) {
      const apiError = error as ApiError
      expect(apiError.status).toBe(422)
      expect(apiError.isValidationError).toBe(true)
      expect(apiError.fieldIssues).toEqual([{ path: 'email', message: 'Invalid email' }])
    }
  })
})
