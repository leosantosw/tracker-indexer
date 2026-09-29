import { NuqsAdapter } from 'nuqs/adapters/react-router/v8'
import { useEffect } from 'react'
import { Outlet, ScrollRestoration } from 'react-router'

import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { AccessDialog } from '@/features/access/access-dialog'
import { useAccessStore } from '@/features/access/access-store'
import { useLiveEvents } from '@/features/live/use-live-events'
import { CheckDialog } from '@/features/trackers/check-dialog'
import { MatchDialog } from '@/features/unmatched/match-dialog'
import { AppHeader } from '@/layout/app-header'
import { useSettings, useStatus } from '@/lib/queries'
import { hideSplash } from '@/lib/splash'

function LoadingPage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-32 rounded-2xl" />
      ))}
    </div>
  )
}

export function AppLayout() {
  const status = useStatus()
  const settings = useSettings()
  const ready = Boolean(status.data && settings.data)
  const running = Boolean(status.data?.job.running)
  const accessNeeded = useAccessStore((state) => Boolean(state.error))
  const failed = status.isError || settings.isError
  useLiveEvents(ready)

  useEffect(() => {
    if (ready || accessNeeded || failed) hideSplash()
  }, [ready, accessNeeded, failed])

  return (
    <NuqsAdapter>
      {running && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
          <div className="h-full w-1/4 animate-indeterminate rounded-full bg-primary" />
        </div>
      )}
      <AppHeader job={status.data?.job} settings={settings.data} />
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
        {ready ? (
          <div className="animate-in duration-500 fade-in slide-in-from-bottom-1">
            <Outlet />
          </div>
        ) : (
          <LoadingPage />
        )}
      </main>
      <AccessDialog />
      <ConfirmDialog />
      <CheckDialog />
      <MatchDialog />
      <ScrollRestoration />
    </NuqsAdapter>
  )
}
