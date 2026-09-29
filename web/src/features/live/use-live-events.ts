import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { useAccessStore } from '@/features/access/access-store'
import { useConnectionStore } from '@/features/live/connection-store'
import { openEvents } from '@/lib/api'
import { REASONS } from '@/lib/labels'
import { useLogStore } from '@/lib/log-store'
import { queryKeys } from '@/lib/queries'
import type { JobStatus, ScheduleStatus, Status } from '@/lib/schemas'

export function useLiveEvents(enabled: boolean) {
  const queryClient = useQueryClient()
  const session = useAccessStore((state) => state.session)

  useEffect(() => {
    if (!enabled) return

    const patchStatus = (patch: { job?: JobStatus; schedule?: ScheduleStatus }) =>
      queryClient.setQueryData<Status>(queryKeys.status, (status) => status && { ...status, ...patch })

    function onJob(job: JobStatus) {
      const previous = queryClient.getQueryData<Status>(queryKeys.status)?.job
      patchStatus({ job })
      if (!previous?.running || job.running) return

      queryClient.invalidateQueries({ queryKey: queryKeys.status })
      queryClient.invalidateQueries({ queryKey: queryKeys.unmatched })
      const reason = job.last?.reason ? REASONS[job.last.reason] : null
      if (reason) toast.warning(reason.text)
    }

    const events = openEvents({
      onOpen: () => {
        useLogStore.getState().clear()
        useConnectionStore.setState({ connected: true })
      },
      onError: () => useConnectionStore.setState({ connected: false }),
      onStatus: onJob,
      onSchedule: (schedule) => patchStatus({ schedule }),
      onLog: useLogStore.getState().append,
    })

    return () => {
      events.close()
      useConnectionStore.setState({ connected: false })
    }
  }, [enabled, session, queryClient])
}
