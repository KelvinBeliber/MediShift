import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry a request the server refused on purpose — a 401 is
        // already handled by the refresh interceptor, and 403/404/409/422 will
        // fail identically every time.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false
        }
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})
