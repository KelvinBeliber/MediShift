import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { authApi } from './api'
import { useAuthStore } from './store'
import { disconnectSocket } from '@/lib/socket'

/**
 * Sign out.
 *
 * `POST /auth/logout` revokes the refresh token server-side and clears the
 * httpOnly cookie; the local session is cleared regardless of whether the
 * request succeeds (a network failure shouldn't trap the user in a session
 * they asked to leave).
 */
export function useLogout() {
  const clear = useAuthStore((s) => s.clear)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clear()
      disconnectSocket()
      void navigate('/login', { replace: true })
    },
  })
}
