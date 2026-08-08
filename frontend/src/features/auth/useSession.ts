import { useEffect } from 'react'
import { useAuthStore } from './store'
import { authApi } from './api'

/**
 * Restore the session on a cold load.
 *
 * The access token is deliberately not persisted, so after a refresh we have
 * nothing in memory — but the httpOnly refresh cookie survives. Hitting an
 * authenticated endpoint triggers the 401 → refresh → replay path in the axios
 * interceptor, which mints a new access token as a side effect. If there is no
 * valid cookie, this fails quietly and the user lands on /login.
 */
export function useSessionBootstrap(): boolean {
  const isBootstrapped = useAuthStore((s) => s.isBootstrapped)
  const setUser = useAuthStore((s) => s.setUser)
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped)

  useEffect(() => {
    if (isBootstrapped) return

    let cancelled = false
    authApi
      .me()
      .then((user) => {
        if (!cancelled) setUser(user)
      })
      .catch(() => {
        // No valid session — expected on first visit.
      })
      .finally(() => {
        if (!cancelled) setBootstrapped(true)
      })

    return () => {
      cancelled = true
    }
  }, [isBootstrapped, setUser, setBootstrapped])

  return isBootstrapped
}
