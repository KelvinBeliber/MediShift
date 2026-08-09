import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { ApiSuccess, Paginated } from './types'
import { toApiError } from './errors'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1'

/**
 * Access-token accessors are injected by the auth store at startup rather than
 * imported, so this module stays free of a circular dependency on the store.
 */
type TokenBridge = {
  getAccessToken: () => string | null
  setAccessToken: (token: string | null) => void
  onRefreshFailed: () => void
}

let bridge: TokenBridge = {
  getAccessToken: () => null,
  setAccessToken: () => {},
  onRefreshFailed: () => {},
}

export function connectTokenBridge(next: TokenBridge): void {
  bridge = next
}

/**
 * Bare instance used only to call POST /auth/refresh.
 *
 * It must not carry the response interceptor below, or a failing refresh would
 * recurse into itself. `withCredentials` matters: on a hard reload the in-memory
 * access token is gone and the httpOnly refresh cookie (path /api/v1/auth) is
 * the only credential we have.
 */
const refreshClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = bridge.getAccessToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

/**
 * Single-flight refresh.
 *
 * A dashboard mounting several queries at once will produce several parallel
 * 401s the moment the 15-minute access token expires. Refreshing per-request
 * would fire N refreshes and race on token rotation (the backend rotates the
 * refresh token on every call), so the first 401 owns the refresh and every
 * other request awaits the same promise, then replays.
 */
let refreshInFlight: Promise<string> | null = null

/**
 * Bumped on sign-out. A refresh that was already in flight when the user signed
 * out will still resolve with a usable access token; without this check it would
 * write that token back into the store *after* the session was cleared, leaving
 * the app quietly signed in again. Comparing the epoch the refresh started under
 * against the current one lets that late result be discarded.
 */
let sessionEpoch = 0

/** Invalidate any in-flight refresh. Call when the session is torn down. */
export function resetAuthClient(): void {
  sessionEpoch += 1
  refreshInFlight = null
}

function refreshAccessToken(): Promise<string> {
  const epoch = sessionEpoch

  refreshInFlight ??= refreshClient
    .post<ApiSuccess<{ accessToken: string }>>('/auth/refresh')
    .then((response) => {
      const token = response.data.data.accessToken
      if (epoch !== sessionEpoch) {
        throw toApiError(new Error('Session ended while refreshing'))
      }
      bridge.setAccessToken(token)
      return token
    })
    .catch((error: unknown) => {
      bridge.setAccessToken(null)
      bridge.onRefreshFailed()
      throw toApiError(error)
    })
    .finally(() => {
      refreshInFlight = null
    })

  return refreshInFlight
}

/** Endpoints where a 401 is the answer, not a signal to refresh. */
function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/register') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/reset-password') ||
    url.includes('/auth/verify-email')
  )
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw toApiError(error)

    const original = error.config as
      (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
    const status = error.response?.status

    if (status === 401 && original && !original._retried && !isAuthEndpoint(original.url)) {
      original._retried = true
      try {
        const token = await refreshAccessToken()
        original.headers.set('Authorization', `Bearer ${token}`)
        return api.request(original)
      } catch (refreshError) {
        throw toApiError(refreshError)
      }
    }

    throw toApiError(error)
  },
)

/**
 * Typed helpers that strip the `{ success, message, data }` envelope.
 * Components and query functions should use these, never `api` directly,
 * so the envelope never leaks past this module.
 */

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.get<ApiSuccess<T>>(url, config)
  return response.data.data
}

export async function post<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await api.post<ApiSuccess<T>>(url, body, config)
  return response.data.data
}

export async function put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.put<ApiSuccess<T>>(url, body, config)
  return response.data.data
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.delete<ApiSuccess<T>>(url, config)
  return response.data.data
}

/** For list endpoints, which return `pagination` alongside `data`. */
export async function getPaginated<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<Paginated<T>> {
  const response = await api.get<ApiSuccess<T[]>>(url, config)
  return {
    items: response.data.data,
    pagination: response.data.pagination ?? {
      page: 1,
      limit: response.data.data.length,
      total: response.data.data.length,
      totalPages: 1,
    },
  }
}
