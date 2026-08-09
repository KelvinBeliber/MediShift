import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { authApi } from './api'
import { useAuthStore } from './store'
import { disconnectSocket } from '@/lib/socket'
import { queryClient } from '@/lib/query'
import { resetAuthClient } from '@/lib/api/client'

/**
 * Sign out.
 *
 * `POST /auth/logout` revokes the refresh token server-side and clears the
 * httpOnly cookie; the local session is cleared regardless of whether the
 * request succeeds (a network failure shouldn't trap the user in a session
 * they asked to leave). The query cache is wiped too — otherwise the next
 * person to sign in on this device would see the previous user's cached
 * data (messages, employee records, ...) until each query happened to
 * refetch.
 *
 * `resetAuthClient()` invalidates any refresh that was already in flight, so a
 * response arriving after this point cannot write a fresh access token back
 * into the store and undo the sign-out.
 */
export function useLogout() {
  const clear = useAuthStore((s) => s.clear)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      resetAuthClient()
      clear()
      queryClient.clear()
      disconnectSocket()
      void navigate('/login', { replace: true })
    },
  })
}
