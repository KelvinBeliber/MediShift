import { create } from 'zustand'
import { connectTokenBridge } from '@/lib/api/client'
import type { AuthUser } from './types'
import type { PermissionKey } from './permissions'

/**
 * Auth session state — and nothing else.
 *
 * The access token lives here in memory rather than localStorage to reduce XSS
 * exposure; it is re-obtained on reload from the httpOnly refresh cookie.
 * Server data belongs to TanStack Query, not this store.
 */
interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  /** False until the initial refresh-on-boot attempt has settled. */
  isBootstrapped: boolean

  setSession: (token: string, user: AuthUser) => void
  setAccessToken: (token: string | null) => void
  setUser: (user: AuthUser | null) => void
  setBootstrapped: (value: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isBootstrapped: false,

  setSession: (accessToken, user) => set({ accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setBootstrapped: (isBootstrapped) => set({ isBootstrapped }),
  clear: () => set({ accessToken: null, user: null }),
}))

/** Read the token outside React (interceptors, socket handshake). */
export const getAccessToken = (): string | null => useAuthStore.getState().accessToken

/** Hand the axios interceptors their token accessors. Called once at startup. */
connectTokenBridge({
  getAccessToken,
  setAccessToken: (token) => useAuthStore.getState().setAccessToken(token),
  onRefreshFailed: () => useAuthStore.getState().clear(),
})

/** Permission lookup usable outside React (e.g. router loaders/guards). */
export function hasPermission(key: PermissionKey): boolean {
  const { user } = useAuthStore.getState()
  return user?.role.permissions.some((p) => p.key === key) ?? false
}
