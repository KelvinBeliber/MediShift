import { useMutation } from '@tanstack/react-query'
import { authApi } from './api'
import { useAuthStore } from './store'
import { queryClient } from '@/lib/query'
import type { AuthUser, LoginCredentials } from './types'

/**
 * Sign in, then build the real session.
 *
 * `POST /auth/login` does NOT return enough to populate the store: its `user`
 * carries `role` as a bare string and no permissions at all. Committing that
 * object would leave `hasPermission()` false forever and render an empty
 * sidebar. So the token is set first — the request interceptor needs it in the
 * store to attach the Bearer header — and only then does `GET /auth/me` fetch
 * the user with its populated role and permissions.
 *
 * If `/me` fails after a successful login, the session is torn back down rather
 * than left half-built with a token but no user; the guards key off `user`, so
 * a half-built session would bounce the user to /login with no explanation.
 *
 * The query cache is cleared as soon as login succeeds, before anything can
 * query with the new token — otherwise a second account signing in on the
 * same device (without an intervening logout, e.g. after a session expired)
 * would render the previous user's cached queries (messages, "me", ...) until
 * each one happened to refetch.
 */
export function useLogin() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setUser = useAuthStore((s) => s.setUser)
  const clear = useAuthStore((s) => s.clear)

  return useMutation<AuthUser, unknown, LoginCredentials>({
    mutationFn: async (credentials) => {
      const { accessToken } = await authApi.login(credentials)
      queryClient.clear()
      setAccessToken(accessToken)

      try {
        return await authApi.me()
      } catch (error) {
        clear()
        throw error
      }
    },
    onSuccess: (user) => setUser(user),
  })
}
