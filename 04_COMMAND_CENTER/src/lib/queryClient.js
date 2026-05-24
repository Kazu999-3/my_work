import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes cache
      refetchOnWindowFocus: false, // Do not refetch aggressively on window focus
      retry: 1, // Retry only once on failure
    },
  },
})
