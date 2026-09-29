import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'
import { toast } from 'sonner'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAccessStore } from '@/features/access/access-store'
import { AppThemeProvider } from '@/layout/theme-provider'
import { AuthError } from '@/lib/api'
import { router } from '@/router'

function onRequestError(error: Error, meta?: Record<string, unknown>) {
  if (error instanceof AuthError) return useAccessStore.getState().deny(error)
  if (!meta?.silent) toast.error(error.message)
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error, query) => onRequestError(error, query.meta) }),
  mutationCache: new MutationCache({ onError: (error, _variables, _context, mutation) => onRequestError(error, mutation.meta) }),
  defaultOptions: { queries: { retry: (count, error) => !(error instanceof AuthError) && count < 2, refetchOnWindowFocus: false } },
})

export function App() {
  return (
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </AppThemeProvider>
  )
}
